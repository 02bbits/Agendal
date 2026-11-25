<?php

namespace App\Pulse;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Pulse\Events\SharedBeat;
use Laravel\Pulse\Pulse;
use Laravel\Pulse\Recorders\Concerns\Throttling;
use Throwable;

/**
 * #199: the server's health for the Pulse "Server health" card, read every 15 s by `pulse:check` (the pulse
 * service). From inside a container /proc/stat, /proc/meminfo and /proc/loadavg describe the whole host and / is
 * the host's disk. A threshold only turns its row red; nobody is notified (#198).
 */
class HostHealth
{
    use Throttling;

    public const CPU_PERCENT = 85;

    public const CPU_MINUTES = 5;

    public const MEMORY_PERCENT = 90;

    public const DISK_PERCENT = 80;

    public const DOWN_MINUTES = 2;

    public const BACKUP_HOURS = 26;

    public string $listen = SharedBeat::class;

    /** The latest CPU %, also drawn by Pulse's Servers card: its own reader runs `top`, which the image lacks */
    public static int $cpu = 0;

    /** @var array{int, int} busy and total jiffies at the last sample (since boot before the first) */
    private array $lastCpu = [0, 0];

    private ?CarbonImmutable $cpuHighSince = null;

    /** @var array<string, CarbonImmutable|null> since when each URL has failed */
    private array $downSince = [];

    public function __construct(private Pulse $pulse, private Repository $config) {}

    public function record(SharedBeat $event): void
    {
        $this->throttle(15, $event, function (SharedBeat $event) {
            $now = $event->time;
            /** @var array{proc: string, disk: string, urls: array<string, string>} $config */
            $config = $this->config->get('pulse.recorders.'.self::class);
            $proc = rtrim($config['proc'], '/');

            self::$cpu = $this->cpu((string) file_get_contents("$proc/stat"));
            $this->cpuHighSince = self::$cpu > self::CPU_PERCENT ? ($this->cpuHighSince ?? $now) : null;
            preg_match_all('/^(\w+):\s+(\d+)/m', (string) file_get_contents("$proc/meminfo"), $m);
            $mem = array_map('intval', array_combine($m[1], $m[2])); // kB
            $memory = 100 - intdiv(100 * $mem['MemAvailable'], max(1, $mem['MemTotal']));
            $cores = preg_match_all('/^cpu\d+ /m', (string) file_get_contents("$proc/stat"));
            $load = explode(' ', (string) file_get_contents("$proc/loadavg"))[0];
            $diskTotal = (float) disk_total_space($config['disk']);
            $disk = (int) round(100 * ($diskTotal - (float) disk_free_space($config['disk'])) / max(1, $diskTotal));
            $db = DB::selectOne("select count(*) as n, current_setting('max_connections') as max from pg_stat_activity");
            $backupAt = @file_get_contents(storage_path('app/last-backup'));
            $backupHours = $backupAt === false ? null : intdiv($now->getTimestamp() - (int) $backupAt, 3600);

            $rows = [
                ['CPU', self::$cpu.'%', self::CPU_PERCENT.'% for '.self::CPU_MINUTES.' min',
                    $this->cpuHighSince?->addMinutes(self::CPU_MINUTES)->lte($now) ?? false],
                ['Load (1 min)', "$load on $cores cores", '', false],
                ['Memory', $memory.'% of '.round($mem['MemTotal'] / 1048576, 1).' GB', self::MEMORY_PERCENT.'%', $memory > self::MEMORY_PERCENT],
                ['Swap', intdiv($mem['SwapTotal'] - $mem['SwapFree'], 1024).' of '.intdiv($mem['SwapTotal'], 1024).' MB', '', false],
                ['Disk', $disk.'% of '.round($diskTotal / 1073741824).' GB', self::DISK_PERCENT.'%', $disk > self::DISK_PERCENT],
                ['Postgres connections', "{$db->n} of {$db->max}", '', false],
                ['Last backup', $backupHours === null ? 'none recorded' : "$backupHours h ago", self::BACKUP_HOURS.' h',
                    $backupHours === null || $backupHours >= self::BACKUP_HOURS],
            ];
            foreach ($config['urls'] as $name => $url) {
                $up = $this->isUp($url);
                $this->downSince[$name] = $up ? null : ($this->downSince[$name] ?? $now);
                $rows[] = [$name, $up ? 'up' : 'down', 'down '.self::DOWN_MINUTES.' min',
                    $this->downSince[$name]?->addMinutes(self::DOWN_MINUTES)->lte($now) ?? false];
            }

            $this->pulse->set('host_health', 'server', json_encode($rows, JSON_THROW_ON_ERROR), $now);
        });
    }

    /** Busy share of the jiffies since the last sample; iowait counts as idle */
    private function cpu(string $stat): int
    {
        $jiffies = array_map('intval', array_slice(preg_split('/\s+/', strtok($stat, "\n") ?: '') ?: [], 1));
        $total = array_sum($jiffies);
        $busy = $total - ($jiffies[3] ?? 0) - ($jiffies[4] ?? 0);
        [$lastBusy, $lastTotal] = $this->lastCpu;
        $this->lastCpu = [$busy, $total];

        return $total > $lastTotal ? (int) round(100 * ($busy - $lastBusy) / ($total - $lastTotal)) : 0;
    }

    private function isUp(string $url): bool
    {
        try {
            return Http::timeout(3)->get($url)->successful();
        } catch (Throwable) {
            return false;
        }
    }
}
