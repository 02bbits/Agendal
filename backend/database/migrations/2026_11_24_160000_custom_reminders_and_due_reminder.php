<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Widen reminder column to allow arbitrary custom numeric offsets (e.g. 10080m)
        DB::statement('ALTER TABLE tasks ALTER COLUMN reminder TYPE VARCHAR(16)');

        // 2. Allow any positive integer offset with unit m, h, d, w, or 'none'
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_reminder');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_reminder CHECK (reminder ~ '^[0-9]+[mhdw]$' OR reminder = 'none')");

        // 3. Add due_reminder and due_remind_at for due date reminders
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('due_reminder', 16)->default('none');
            $table->timestampTz('due_remind_at')->nullable();
        });

        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_due_reminder CHECK (due_reminder ~ '^[0-9]+[mhdw]$' OR due_reminder = 'none')");
        DB::statement('CREATE INDEX tasks_due_remind_at ON tasks (due_remind_at) WHERE due_remind_at IS NOT NULL AND NOT done AND deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tasks_due_remind_at');
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_due_reminder');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['due_reminder', 'due_remind_at']);
        });

        // Revert reminder check constraint
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_reminder');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_reminder CHECK (reminder IN ('none', '0m', '5m', '10m', '15m', '30m', '1h', '2h', '1d', '2d', '1w'))");
        DB::statement('ALTER TABLE tasks ALTER COLUMN reminder TYPE VARCHAR(4)');
    }
};
