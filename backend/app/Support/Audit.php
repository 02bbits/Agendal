<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// NF-20: one row per security event. Callers pass only the event name and the user, so a
// password or token can't end up in the log.
class Audit
{
    public const KEEP_DAYS = 90;

    public static function log(Request $request, string $event, ?int $userId): void
    {
        DB::table('audit_events')->insert([
            'user_id' => $userId, 'event' => $event, 'ip' => $request->ip(), 'user_agent' => $request->userAgent(),
        ]);
    }
}
