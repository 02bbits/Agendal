<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE INDEX tasks_note_candidates_trgm ON tasks USING gin (immutable_unaccent(title) gin_trgm_ops) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tasks_note_candidates_trgm');
    }
};
