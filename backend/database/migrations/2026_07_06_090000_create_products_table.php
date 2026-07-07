<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('input_type')->default('name');
            $table->string('product_name')->nullable();
            $table->string('product_url')->nullable();
            $table->text('manual_info')->nullable();
            $table->string('language')->default('en');
            $table->string('tone')->default('professional');
            $table->string('target_country')->default('US');
            $table->string('category')->nullable();
            $table->json('generated_content')->nullable();
            $table->unsignedTinyInteger('seo_score')->nullable();
            $table->json('seo_checks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
