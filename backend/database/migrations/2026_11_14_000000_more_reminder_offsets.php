<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// #154: more reminder offsets for tasks (at the start, 10 min, 2 h, 2 days, 1 week before)
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_reminder');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_reminder CHECK (reminder IN ('none', '0m', '5m', '10m', '15m', '30m', '1h', '2h', '1d', '2d', '1w'))");
    }

    public function down(): void
    {
        // The old list can't hold the new offsets: those reminders are turned off first
        DB::table('tasks')->whereIn('reminder', ['0m', '10m', '2h', '2d', '1w'])->update(['reminder' => 'none', 'remind_at' => null]);
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_reminder');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_reminder CHECK (reminder IN ('none', '5m', '15m', '30m', '1h', '1d'))");
    }
};
