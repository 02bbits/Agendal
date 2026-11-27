<?php

declare(strict_types=1);

namespace App\Services\Monitoring;

use App\Pulse\HostHealth;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * #229: the Server health thresholds of #199 posted to the admins' Discord (brief 5(d)). Only a change
 * is posted: a row turning red, and back to normal; the last state per row is kept in the cache so a
 * restart neither repeats nor loses one. The readings are HostHealth's own, nothing is measured twice.
 */
final class ServerHealthAlert
{
    /** The card calls the monitor stopped after this long without a reading (ServerHealth) */
    public const STALE_MINUTES = 1;

    // Disk fills slowly and is planned for; the rest needs someone now
    private const WARNING_ROWS = ['Disk'];

    public function __construct(private readonly DiscordAlert $discord) {}

    /**
     * HostHealth's rows after each reading: [name, value, threshold, over]
     *
     * @param  list<array{0: string, 1: string, 2: string, 3: bool}>  $rows
     */
    public function rows(array $rows): void
    {
        foreach ($rows as [$name, $value, $threshold, $over]) {
            if ($threshold === '') {
                continue; // shown on the card, no threshold
            }
            $this->changed("host-health:$name", $over, ['host_over', 'host_normal'], ['metric' => $this->metric($name)], [
                [$this->discord->trans('fields.metric'), $this->metric($name)],
                [$this->discord->trans('fields.value'), $value],
                [$this->discord->trans('fields.threshold'), $threshold],
            ], in_array($name, self::WARNING_ROWS, true) ? DiscordAlert::WARNING : DiscordAlert::CRITICAL);
        }
    }

    /** Every minute from the scheduler: no reading means nothing above can alert either */
    public function checkMonitor(): void
    {
        $at = DB::connection(config('pulse.storage.database.connection'))->table('pulse_values')
            ->where('type', 'host_health')->where('key', 'server')->value('timestamp');
        $stale = $at === null || CarbonImmutable::createFromTimestamp((int) $at)->addMinutes(self::STALE_MINUTES)->isPast();

        $this->changed('host-health:monitor', $stale, ['monitor_down', 'monitor_up'], ['minutes' => self::STALE_MINUTES], [
            [$this->discord->trans('fields.last_reading'), $at === null ? '-' : CarbonImmutable::createFromTimestamp((int) $at, 'UTC')->format('Y-m-d H:i:s').' UTC'],
        ], DiscordAlert::CRITICAL);
    }

    /**
     * @param  array{string, string}  $kinds  the lang blocks for over and back to normal
     * @param  array<string, scalar>  $replace
     * @param  list<array{0: string, 1: string, 2?: bool}>  $fields
     */
    private function changed(string $key, bool $over, array $kinds, array $replace, array $fields, string $severity): void
    {
        $was = (bool) rescue(fn () => DiscordAlert::cache()->get($key), false, false);
        if ($over === $was) {
            return;
        }
        rescue(fn () => DiscordAlert::cache()->forever($key, $over), report: false);

        $kind = $kinds[$over ? 0 : 1];
        $t = $this->discord->trans(...);
        // The state goes in the key, so a row flapping inside the window posts each direction once
        $this->discord->send($key.($over ? ':over' : ':normal'), $over ? $severity : DiscordAlert::RESOLVED,
            $t("$kind.title", $replace), $t("$kind.summary", $replace), $fields);
    }

    private function metric(string $row): string
    {
        $key = 'metrics.'.str_replace(' ', '_', strtolower($row));
        $text = $this->discord->trans($key);

        return $text === "monitoring.$key" ? $row : $text;
    }
}
