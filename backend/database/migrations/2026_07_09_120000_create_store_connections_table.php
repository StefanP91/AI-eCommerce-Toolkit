<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('store_url', 500);
            $table->string('status', 32)->default('pending');
            $table->unsignedSmallInteger('product_count')->default(0);
            $table->unsignedTinyInteger('avg_seo_score')->nullable();
            $table->timestamp('last_scanned_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::create('store_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_connection_id')->constrained()->cascadeOnDelete();
            $table->string('url', 500);
            $table->string('product_name')->nullable();
            $table->unsignedTinyInteger('seo_score')->nullable();
            $table->json('seo_checks')->nullable();
            $table->string('status', 32)->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamp('last_scanned_at')->nullable();
            $table->timestamps();

            $table->unique(['store_connection_id', 'url']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_products');
        Schema::dropIfExists('store_connections');
    }
};
