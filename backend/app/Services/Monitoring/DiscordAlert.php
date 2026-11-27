<?php

declare(strict_types=1);

namespace App\Services\Monitoring;

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

    // Warning amber, critical red
    private const COLORS = [self::WARNING => 0xE67E22, self::CRITICAL => 0xC0392B];

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
        // The cache may be the database that just failed (an outage is the alert that matters most): then
        // throttle in this container's file cache, and never throw while reporting
        $add = fn (?string $store) => Cache::store($store)->add('discord-alert:'.sha1($key), true, now()->addMinutes($minutes));
        if ($url === '' || ! (rescue(fn () => $add(null), null, false) ?? rescue(fn () => $add('file'), false, false))) {
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

        // After the response, and a failed post never fails the request
        defer(fn () => rescue(
            fn () => Http::timeout(5)->post($url, ['embeds' => [$embed]])->throw(),
            fn (Throwable $e) => Log::warning('Discord alert not sent', ['error' => class_basename($e)]),
            report: false,
        ));
    }

    private function webhookUrl(): string
    {
        $file = (string) config('logging.discord_alert.webhook_file');

        return $file !== '' && is_file($file) && is_readable($file) ? trim((string) file_get_contents($file)) : '';
    }
}
