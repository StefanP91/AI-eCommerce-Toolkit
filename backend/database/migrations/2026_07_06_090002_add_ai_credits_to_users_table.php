<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('plan')->default('free')->after('password');
            $table->unsignedSmallInteger('ai_generations_today')->default(0)->after('plan');
            $table->date('ai_generations_date')->nullable()->after('ai_generations_today');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['plan', 'ai_generations_today', 'ai_generations_date']);
        });
    }
};
