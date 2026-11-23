<?php

declare(strict_types=1);

namespace App\Services\Push;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;

/**
 * Claims the reminders that are due (TK §2.5, scalability.md). One statement does it all:
 * due, at most `late_minutes` late, open, not deleted, never sent; rows another worker holds
 * are skipped (FOR UPDATE SKIP LOCKED), and the delivery row is written before anything is
 * sent (ON CONFLICT DO NOTHING), so however many workers run, a reminder is claimed once.
 */
final class DueReminders
{
    /**
     * @return list<array{task_id: string, remind_at: string}>
     */
    public function claim(DateTimeImmutable $now, int $limit): array
    {
        $now = $now->setTimezone(new DateTimeZone('UTC'));
        $oldest = $now->modify('-'.(int) config('push.late_minutes').' minutes');

        $rows = DB::select(<<<'SQL'
            WITH due AS (
                SELECT t.id, t.remind_at
                FROM tasks t
                WHERE t.remind_at IS NOT NULL AND NOT t.done AND t.deleted_at IS NULL
                  AND t.remind_at <= ? AND t.remind_at > ?
                  AND NOT EXISTS (
                      SELECT 1 FROM reminder_deliveries d
                      WHERE d.task_id = t.id AND d.remind_at = t.remind_at
                  )
                ORDER BY t.remind_at
                LIMIT ?
                FOR UPDATE OF t SKIP LOCKED
            )
            INSERT INTO reminder_deliveries (task_id, remind_at, sent_at)
            SELECT id, remind_at, ? FROM due
            ON CONFLICT DO NOTHING
            RETURNING task_id, remind_at
            SQL, [$now->format(DATE_ATOM), $oldest->format(DATE_ATOM), $limit, $now->format(DATE_ATOM)]);

        $claimed = [];
        foreach ($rows as $row) {
            $fields = (array) $row;
            $claimed[] = ['task_id' => (string) ($fields['task_id'] ?? ''), 'remind_at' => (string) ($fields['remind_at'] ?? '')];
        }

        return $claimed;
    }
}
