<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email', 254)->unique();
            $table->string('display_name', 100)->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->string('timezone', 64)->default('Asia/Ho_Chi_Minh');
            $table->boolean('remember_device')->default(true);
            $table->string('theme', 6)->default('system');
            $table->string('week_start', 3)->default('mon');
            $table->string('time_format', 3)->default('24h');
            $table->boolean('install_prompt_shown')->default(false);
            $table->timestamps();
        });

        // Data model: email stored lower case; settings limited to their options (AP-3, AP-5)
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_email_lower CHECK (email = lower(email))');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_theme CHECK (theme IN ('system', 'light', 'dark'))");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_week_start CHECK (week_start IN ('mon', 'sun'))");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_time_format CHECK (time_format IN ('24h', '12h'))");

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
