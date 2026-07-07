<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulk_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('filename');
            $table->string('status')->default('pending');
            $table->unsignedSmallInteger('total_rows')->default(0);
            $table->unsignedSmallInteger('processed_rows')->default(0);
            $table->unsignedSmallInteger('successful_rows')->default(0);
            $table->unsignedSmallInteger('failed_rows')->default(0);
            $table->json('defaults')->nullable();
            $table->timestamps();
        });

        Schema::create('bulk_upload_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bulk_upload_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('row_number');
            $table->string('input_type')->default('name');
            $table->string('product_name')->nullable();
            $table->string('product_url', 500)->nullable();
            $table->text('manual_info')->nullable();
            $table->string('language')->default('en');
            $table->string('tone')->default('professional');
            $table->string('target_country')->default('US');
            $table->string('category')->nullable();
            $table->string('status')->default('pending');
            $table->text('error_message')->nullable();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_upload_items');
        Schema::dropIfExists('bulk_uploads');
    }
};
