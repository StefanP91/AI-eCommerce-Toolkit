<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('lemon_squeezy_customer_id')->nullable()->after('status');
            $table->string('lemon_squeezy_subscription_id')->nullable()->after('lemon_squeezy_customer_id');
            $table->string('subscription_status')->nullable()->after('lemon_squeezy_subscription_id');
            $table->timestamp('subscription_ends_at')->nullable()->after('subscription_status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'lemon_squeezy_customer_id',
                'lemon_squeezy_subscription_id',
                'subscription_status',
                'subscription_ends_at',
            ]);
        });
    }
};
