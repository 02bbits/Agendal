<?php

declare(strict_types=1);

namespace App\Services\Monitoring;

use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * #228: critical errors posted to the admins' Discord (brief 5(b)): an unhandled exception that
 * answers 5xx, a failed queued job, a failed scheduled task. The exception class and where it was
 * thrown only, never its message: it can carry note or task text (SC-21).
 */
final class CriticalErrorAlert
{
    public function __construct(private readonly DiscordAlert $discord) {}

    /** A reported exception during an HTTP request; jobs and scheduled tasks have their own alert */
    public function exception(Throwable $e): void
    {
        $route = request()->route();
        if ($route === null || ($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500)) {
            return;
        }

        $t = $this->discord->trans(...);
        $this->post('server_error', $e, [
            [$t('fields.where'), '`'.request()->method().' /'.ltrim($route->uri(), '/').'`'],
            [$t('fields.request_id'), '`'.Context::get('request_id', '-').'`'],
        ]);
    }

    public function jobFailed(JobFailed $event): void
    {
        $t = $this->discord->trans(...);
        $job = class_basename($event->job->resolveName());
        $maxTries = $event->job->maxTries();
        $this->post('job_failed', $event->exception, [
            [$t('fields.job'), "`$job`"],
            [$t('fields.attempts'), $event->job->attempts().($maxTries ? " / $maxTries" : '')],
        ], $job);
    }

    public function scheduledTaskFailed(ScheduledTaskFailed $event): void
    {
        $t = $this->discord->trans(...);
        $task = $event->task;
        // "'/usr/local/bin/php' 'artisan' telescope:prune" → "telescope:prune"; a closure has a description
        $command = $task->command !== null ? Str::after($task->command, "'artisan' ") : $task->getSummaryForDisplay();
        $fields = [[$t('fields.command'), "`$command`"]];
        if ($task->exitCode !== null) {
            $fields[] = [$t('fields.exit_code'), (string) $task->exitCode];
        }
        // A command runs in its own process: the scheduler only knows its exit code, and throws a generic
        // Exception about it, whose class and line say nothing. The command's own log has the error
        $this->post('schedule_failed', $task->command === null ? $event->exception : null, $fields, $command);
    }

    /**
     * @param  list<array{0: string, 1: string, 2?: bool}>  $fields
     */
    private function post(string $kind, ?Throwable $e, array $fields, string $key = ''): void
    {
        $t = $this->discord->trans(...);
        $source = $e === null ? '' : $this->source($e);
        if ($e !== null) {
            $fields = [
                [$t('fields.error'), '`'.get_class($e).'`'],
                ...$fields,
                [$t('fields.source'), "`$source`", false],
            ];
        }

        // One message per fault (class and line, per job or command) per window
        $this->discord->send($kind.$key.($e === null ? '' : get_class($e)).$source, DiscordAlert::CRITICAL, $t("$kind.title"), $t("$kind.summary"), $fields);
    }

    /** The first place in the app's own code: a database error is thrown deep in vendor/, which says nothing */
    private function source(Throwable $e): string
    {
        $root = base_path().DIRECTORY_SEPARATOR;
        $vendor = $root.'vendor'.DIRECTORY_SEPARATOR;
        foreach ([['file' => $e->getFile(), 'line' => $e->getLine()], ...$e->getTrace()] as $frame) {
            $file = $frame['file'] ?? '';
            if (str_starts_with($file, $root) && ! str_starts_with($file, $vendor)) {
                return Str::after($file, $root).':'.($frame['line'] ?? 0);
            }
        }

        return Str::after($e->getFile(), $root).':'.$e->getLine();
    }
}
