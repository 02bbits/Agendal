<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Deleting a note can be undone (RV §2.7): it is soft-deleted like tasks and projects.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', fn (Blueprint $table) => $table->softDeletesTz());
    }

    public function down(): void
    {
        Schema::table('notes', fn (Blueprint $table) => $table->dropSoftDeletes());
    }
};
