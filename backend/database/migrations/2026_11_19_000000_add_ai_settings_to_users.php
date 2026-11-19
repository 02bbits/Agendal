<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Settings › AI: whether unclear notes go to a model, the user's own provider keys (encrypted) and the chosen model.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('llm_enabled')->default(true);
            $table->string('llm_model', 200)->nullable();
            $table->text('llm_keys')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['llm_enabled', 'llm_model', 'llm_keys']);
        });
    }
};
