<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Clock\ClockInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * ADR-005: tombstones go 30 days after deletion. A device whose cursor is older than the newest
 * purged change gets `410` and downloads everything again (AP-E8).
 *
 * Undo all still works: a note only touches open tasks, so a task deleted more than 30 days ago
 * was deleted after a note that is past its 30-day undo window.
 */
class PurgeTombstones extends Command
{
    public const KEEP_DAYS = 30;

    protected $signature = 'sync:purge';

    protected $description = 'Delete tombstones older than 30 days and move the sync horizon';

    public function handle(ClockInterface $clock): int
    {
        $before = $clock->now()->modify('-'.self::KEEP_DAYS.' days');
        DB::transaction(function () use ($before): void {
            $purged = 0;
            // Tasks first: a project's tasks point at it
            foreach (['tasks', 'notes', 'projects'] as $table) {
                $rows = DB::table($table)->whereNotNull('deleted_at')->where('deleted_at', '<', $before);
                $purged = max($purged, (int) (clone $rows)->max('change_seq'));
                $rows->delete();
            }
            if ($purged > 0) {
                DB::update('update sync_horizon set purged_seq = greatest(purged_seq, ?)', [$purged]);
            }
        });

        return self::SUCCESS;
    }
}
