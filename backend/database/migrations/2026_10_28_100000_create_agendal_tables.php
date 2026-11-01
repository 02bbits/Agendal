<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Tables from docs/07-architecture/data-model.md. Rules the database can enforce are CHECKs,
// partial unique indexes and a trigger, so no code path can skip them.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');

        // unaccent() is not IMMUTABLE, so it can't be used in an index directly (LV-3, NU-3)
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
            LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
            AS $$ SELECT public.unaccent('public.unaccent', $1) $$
        SQL);

        // ADR-005: every write to tasks, projects and notes takes change_seq from one sequence
        DB::statement('CREATE SEQUENCE IF NOT EXISTS change_seq');
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION bump_change_seq() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                NEW.change_seq := nextval('change_seq');
                RETURN NEW;
            END $$
        SQL);

        Schema::create('projects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->string('colour', 6);
            $table->timestampsTz();
            $table->bigInteger('change_seq');
            $table->softDeletesTz();

            $table->index(['user_id', 'change_seq']);
        });
        DB::statement("ALTER TABLE projects ADD CONSTRAINT projects_colour CHECK (colour IN ('blue', 'red', 'orange', 'yellow', 'green', 'teal', 'purple', 'gray'))");
        DB::statement('CREATE UNIQUE INDEX projects_user_name_unique ON projects (user_id, lower(name)) WHERE deleted_at IS NULL');

        Schema::create('notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('client_id');
            $table->string('text', 5000);
            $table->string('name', 35)->nullable();
            $table->string('source_file_name')->nullable();
            $table->string('status', 8);
            $table->jsonb('plan')->nullable();
            $table->jsonb('applied')->default('[]');
            $table->jsonb('undo_log')->nullable();
            $table->string('engine', 14)->nullable();
            $table->string('prompt_version', 32)->nullable();
            $table->timestampTz('written_at');
            $table->string('written_tz', 64);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('processed_at')->nullable();
            $table->timestampTz('edited_at')->nullable();
            $table->bigInteger('change_seq');

            $table->unique(['user_id', 'client_id']);
            $table->index(['user_id', 'change_seq']);
        });
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_status CHECK (status IN ('pending', 'new', 'done', 'confirm', 'followup', 'kept', 'undone'))");
        DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_engine CHECK (engine IN ('rules', 'rules_llm', 'rules_fallback'))");
        DB::statement('CREATE INDEX notes_user_written_at ON notes (user_id, written_at DESC, id)');

        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 200);
            $table->date('due_date')->nullable();
            $table->time('start_time', 0)->nullable();
            $table->time('end_time', 0)->nullable();
            $table->string('priority', 6)->nullable();
            $table->string('reminder', 4)->default('none');
            $table->string('repeat', 7)->default('never');
            $table->string('notes', 5000)->nullable();
            $table->boolean('done')->default(false);
            $table->timestampTz('done_at')->nullable();
            $table->string('created_by', 9)->default('user');
            $table->foreignUuid('source_note_id')->nullable()->constrained('notes')->nullOnDelete();
            $table->timestampsTz();
            $table->jsonb('field_updated_at')->default('{}');
            $table->timestampTz('remind_at')->nullable();
            $table->date('repeat_anchor')->nullable();
            $table->uuid('previous_occurrence_id')->nullable()->unique();
            $table->bigInteger('change_seq');
            $table->softDeletesTz();

            $table->index(['user_id', 'change_seq']);
            $table->index(['user_id', 'due_date']);
            $table->index(['user_id', 'done']);
        });
        // Added after create: a self-reference needs the primary key to exist first
        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_previous_occurrence_fk FOREIGN KEY (previous_occurrence_id) REFERENCES tasks (id) ON DELETE SET NULL');
        DB::statement('ALTER TABLE tasks ADD CONSTRAINT tasks_end_after_start CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_priority CHECK (priority IN ('low', 'medium', 'high'))");
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_reminder CHECK (reminder IN ('none', '5m', '15m', '30m', '1h', '1d'))");
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_repeat CHECK (repeat IN ('never', 'daily', 'weekly', 'monthly', 'yearly'))");
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_created_by CHECK (created_by IN ('user', 'assistant'))");
        DB::statement('CREATE INDEX tasks_remind_at ON tasks (remind_at) WHERE remind_at IS NOT NULL AND NOT done AND deleted_at IS NULL');
        DB::statement("CREATE INDEX tasks_search_trgm ON tasks USING gin (immutable_unaccent(title || ' ' || coalesce(notes, '')) gin_trgm_ops)");

        foreach (['projects', 'notes', 'tasks'] as $synced) {
            DB::statement("CREATE TRIGGER {$synced}_change_seq BEFORE INSERT OR UPDATE ON {$synced} FOR EACH ROW EXECUTE FUNCTION bump_change_seq()");
        }

        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('endpoint')->unique();
            $table->jsonb('keys');
            $table->timestampsTz();
        });

        Schema::create('reminder_deliveries', function (Blueprint $table) {
            $table->foreignUuid('task_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('remind_at');
            $table->timestampTz('sent_at')->useCurrent();

            $table->primary(['task_id', 'remind_at']);
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 50);
            $table->ipAddress('ip')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('reminder_deliveries');
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('notes');
        Schema::dropIfExists('projects');
        DB::statement('DROP FUNCTION IF EXISTS bump_change_seq()');
        DB::statement('DROP SEQUENCE IF EXISTS change_seq');
        DB::statement('DROP FUNCTION IF EXISTS immutable_unaccent(text)');
    }
};
