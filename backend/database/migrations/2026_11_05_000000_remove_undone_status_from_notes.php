<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notes')->where('status', 'undone')->update(['status' => 'pending']);
        DB::statement('ALTER TABLE notes DROP CONSTRAINT notes_status');
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_status CHECK (status IN ('pending', 'new', 'done', 'confirm', 'followup', 'kept'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE notes DROP CONSTRAINT notes_status');
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_status CHECK (status IN ('pending', 'new', 'done', 'confirm', 'followup', 'kept', 'undone'))");
    }
};
