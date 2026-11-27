<?php

declare(strict_types=1);

namespace App\Services\Monitoring;

use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Posts an alert to the admins' Discord channel as one formal embed (#225). The webhook URL lives
 * only in a file (e.g. a Docker secret), read on each alert so `config:cache` never copies it.
 * Without the file nothing is posted. Callers pass no user content (SC-21).
 */
final class DiscordAlert
{
    public const WARNING = 'warning';

    public const CRITICAL = 'critical';

    /** A problem posted earlier is over (#229) */
    public const RESOLVED = 'resolved';

    // Warning amber, critical red, resolved green
    private const COLORS = [self::WARNING => 0xE67E22, self::CRITICAL => 0xC0392B, self::RESOLVED => 0x27AE60];

    /**
     * Text in the admins' language, apart from the app's (lang/<locale>/monitoring.php)
     *
     * @param  array<string, scalar>  $replace
     */
    public function trans(string $key, array $replace = []): string
    {
        return (string) __("monitoring.$key", $replace, (string) config('logging.discord_alert.locale'));
    }

    /**
     * Posts once per $key per window: the same fault repeats on every run.
     *
     * @param  list<array{0: string, 1: string, 2?: bool}>  $fields  [label, value, inline = true]
     */
    public function send(string $key, string $severity, string $title, string $summary, array $fields): void
    {
        $url = $this->webhookUrl();
        $minutes = (int) config('logging.discord_alert.throttle_minutes');
        // Never throws while reporting. The throttle is not in the database (see self::cache())
        if ($url === '' || ! rescue(fn () => self::cache()->add('discord-alert:'.sha1($key), true, now()->addMinutes($minutes)), false, false)) {
            return;
        }

        $field = fn (string $name, string $value, bool $inline = true) => ['name' => $name, 'value' => $value, 'inline' => $inline];
        $embed = [
            'title' => $title,
            'description' => $summary,
            'color' => self::COLORS[$severity],
            'fields' => [
                $field($this->trans('fields.severity'), $this->trans("severity.$severity")),
                $field($this->trans('fields.environment'), app()->environment()),
                ...array_map(fn (array $f) => $field(...$f), $fields),
            ],
        ];

        // A failed post logs a warning and never fails the caller
        $post = fn () => rescue(
            fn () => Http::timeout(5)->post($url, ['embeds' => [$embed]])->throw(),
            fn (Throwable $e) => Log::warning('Discord alert not sent', ['error' => class_basename($e)]),
            report: false,
        );
        // A request posts after its response, even an error response (`always`: Laravel otherwise drops
        // deferred work on a 4xx/5xx). queue:work, schedule:work and pulse:check never end, and Laravel
        // drops deferred work after a failed job or a failed schedule:run, so the console posts now
        app()->runningInConsole() ? $post() : defer($post)->always();
    }

    /**
     * The alerts' own state (throttle, last server health). Not the app's database cache: in an outage,
     * the alert that matters most, each try to reach the database takes seconds and the request hits
     * PHP's 30 s limit before the alert is posted. In production the file cache sits on the api-storage
     * volume that api, queue, scheduler and pulse share.
     */
    public static function cache(): Repository
    {
        return Cache::store((string) config('logging.discord_alert.cache_store'));
    }

    private function webhookUrl(): string
    {
        $file = (string) config('logging.discord_alert.webhook_file');
        if ($file === '') {
            return '';
        }
        // Configured but unreadable (missing secret, wrong owner): say so, or alerts stop without a trace
        if (! is_file($file) || ! is_readable($file)) {
            Log::warning('Discord alert webhook file unreadable', ['file' => $file]);

            return '';
        }

        return trim((string) file_get_contents($file));
    }
}
