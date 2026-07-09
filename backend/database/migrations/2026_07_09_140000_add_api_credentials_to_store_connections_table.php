<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_connections', function (Blueprint $table) {
            $table->string('platform', 32)->nullable()->after('store_password');
            $table->text('api_credentials')->nullable()->after('platform');
            $table->timestamp('api_connected_at')->nullable()->after('api_credentials');
        });
    }

    public function down(): void
    {
        Schema::table('store_connections', function (Blueprint $table) {
            $table->dropColumn(['platform', 'api_credentials', 'api_connected_at']);
        });
    }
};
