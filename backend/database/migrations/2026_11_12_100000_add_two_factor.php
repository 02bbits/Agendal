<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('two_factor_enabled')->default(false);
        });

        Schema::table('email_verification_codes', function (Blueprint $table) {
            $table->string('purpose', 16)->default('verify');
            $table->dropPrimary();
            $table->primary(['user_id', 'purpose']);
        });
    }

    public function down(): void
    {
        Schema::table('email_verification_codes', function (Blueprint $table) {
            $table->dropPrimary();
            $table->dropColumn('purpose');
            $table->primary('user_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('two_factor_enabled');
        });
    }
};
