<?php

use App\Console\Commands\PurgeTombstones;
use App\Support\Audit;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// NF-20: the audit log is kept 90 days
Schedule::call(fn () => DB::table('audit_events')->where('created_at', '<', now()->subDays(Audit::KEEP_DAYS))->delete())
    ->daily()->name('purge-audit-events');

// ADR-005: tombstones are kept 30 days, then purged; older cursors get 410
Schedule::command('sync:purge')->daily();

// Retention (scalability.md): expired one-time codes and old reminder sends
Schedule::command('auth:clear-resets')->daily();
// #196: personal access tokens a day past expiry
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::call(fn () => DB::table('email_verification_codes')->where('expires_at', '<', now()->subDay())->delete())
    ->daily()->name('purge-email-codes');
Schedule::call(fn () => DB::table('reminder_deliveries')->where('sent_at', '<', now()->subDays(PurgeTombstones::KEEP_DAYS))->delete())
    ->daily()->name('purge-reminder-deliveries');

// TK-6 reminders: claim what is due and queue the pushes. withoutOverlapping: a slow run never
// stacks; the claim itself is safe with several workers (FOR UPDATE SKIP LOCKED).
Schedule::command('reminders:send')->everyMinute()->withoutOverlapping(5);

// #192: Telescope keeps 48 hours
Schedule::command('telescope:prune --hours=48')->daily();
