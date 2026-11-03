<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Start date and due time (TK-3, data-model.md); end_time moves to due_time.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->date('start_date')->nullable();
            $table->time('due_time', 0)->nullable();
        });

        DB::statement('UPDATE tasks SET start_date = due_date WHERE start_time IS NOT NULL AND due_date IS NOT NULL');
        DB::statement('UPDATE tasks SET due_time = end_time WHERE end_time IS NOT NULL');
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT tasks_end_after_start');

        Schema::table('tasks', fn (Blueprint $table) => $table->dropColumn('end_time'));

        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_start_before_due CHECK (start_date IS NULL OR due_date IS NULL OR start_date < due_date OR (start_date = due_date AND (start_time IS NULL OR due_time IS NULL OR start_time < due_time)))');

        Schema::table('tasks', fn (Blueprint $table) => $table->index(['user_id', 'start_date']));
    }

    public function down(): void
    {
        Schema::table('tasks', fn (Blueprint $table) => $table->dropIndex(['user_id', 'start_date']));

        DB::statement('ALTER TABLE tasks DROP CONSTRAINT tasks_start_before_due');

        Schema::table('tasks', fn (Blueprint $table) => $table->time('end_time', 0)->nullable());

        DB::statement('UPDATE tasks SET end_time = due_time WHERE due_time IS NOT NULL AND start_time IS NOT NULL AND due_time > start_time');
        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_end_after_start CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['start_date', 'due_time']);
        });
    }
};
