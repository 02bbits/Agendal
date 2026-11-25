<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Manual order for drag and drop (#178, ADR-009). Fractional-index keys: moving a task
 * writes only its own key, so no other row changes and sync stays one field per edit.
 * project_order orders a project's list and Inbox No date; day_order orders a day (Today,
 * an Upcoming day). Null means "not placed by hand": the list's rules order it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('project_order', 64)->nullable()->collation('C');
            $table->string('day_order', 64)->nullable()->collation('C');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['project_order', 'day_order']);
        });
    }
};
