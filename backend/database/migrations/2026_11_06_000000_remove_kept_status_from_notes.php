<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // A kept note is a Check this first plan that was set aside: its plan is intact, so it is
        // reviewed again (Apply re-checks every task, NU-E38) instead of reading as undone
        DB::table('notes')->where('status', 'kept')->update(['status' => 'confirm']);
        DB::statement('ALTER TABLE notes DROP CONSTRAINT notes_status');
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_status CHECK (status IN ('pending', 'new', 'done', 'confirm', 'followup'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE notes DROP CONSTRAINT notes_status');
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_status CHECK (status IN ('pending', 'new', 'done', 'confirm', 'followup', 'kept'))");
    }
};
