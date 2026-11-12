<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // ADR-004/005: per-field stamps on projects too, and how far tombstones have been purged
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->jsonb('field_updated_at')->default('{}');
        });
        Schema::create('sync_horizon', function (Blueprint $table): void {
            $table->unsignedBigInteger('purged_seq');
        });
        DB::table('sync_horizon')->insert(['purged_seq' => 0]);
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_horizon');
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('field_updated_at');
        });
    }
};
