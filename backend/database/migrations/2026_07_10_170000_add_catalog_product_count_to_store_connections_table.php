<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_connections', function (Blueprint $table) {
            $table->unsignedSmallInteger('catalog_product_count')->nullable()->after('product_count');
        });
    }

    public function down(): void
    {
        Schema::table('store_connections', function (Blueprint $table) {
            $table->dropColumn('catalog_product_count');
        });
    }
};
