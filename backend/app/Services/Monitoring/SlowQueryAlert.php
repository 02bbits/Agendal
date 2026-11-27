<?php

declare(strict_types=1);

namespace App\Services\Monitoring;

use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * #192/#225: a slow query is logged at error and posted to the admins' Discord.
 * SQL only, never bindings: they carry note and task text (SC-21).
 */
final class SlowQueryAlert
{
    // An embed field holds at most 1024 characters, code fence included
    private const MAX_SQL_CHARS = 990;

    /** Inside an alert: its own queries (the database cache's throttle) are not alerted on again */
    private bool $alerting = false;

    public function __construct(private readonly DiscordAlert $discord) {}

    public function __invoke(string $sql, ?float $ms): void
    {
        Log::error('Slow query', ['sql' => $sql, 'ms' => $ms]);
        // With CACHE_STORE=database the throttle is a query too: were it slow, it would alert, throttle
        // with the same query and alert again, forever
        if ($this->alerting) {
            return;
        }
        $this->alerting = true;
        try {
            $this->post($sql, $ms);
        } finally {
            $this->alerting = false;
        }
    }

    private function post(string $sql, ?float $ms): void
    {
        $t = $this->discord->trans(...);
        $fields = [
            [$t('fields.duration'), number_format((float) $ms).' ms'],
            [$t('fields.threshold'), number_format((int) config('database.slow_query_ms')).' ms'],
            [$t('fields.where'), '`'.$this->where().'`'],
            [$t('fields.request_id'), '`'.Context::get('request_id', '-').'`'],
            [$t('fields.sql'), "```sql\n".Str::limit($sql, self::MAX_SQL_CHARS)."\n```", false],
        ];

        // One message per SQL shape per window
        $this->discord->send('slow_query'.$sql, DiscordAlert::WARNING, $t('slow_query.title'), $t('slow_query.summary'), $fields);
    }

    /** The route pattern (no ids, no query string), else the queued job, else the artisan command */
    private function where(): string
    {
        $route = request()->route();
        if ($route !== null) {
            return request()->method().' /'.ltrim($route->uri(), '/');
        }

        return Context::getHidden('job') ?? 'artisan '.($_SERVER['argv'][1] ?? '-');
    }
}
