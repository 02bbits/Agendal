<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Which plan the note holds: Apply names the one the user reviewed (RV §7)
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table): void {
            $table->unsignedInteger('plan_version')->default(1);
        });
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table): void {
            $table->dropColumn('plan_version');
        });
    }
};
