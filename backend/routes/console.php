<?php

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
