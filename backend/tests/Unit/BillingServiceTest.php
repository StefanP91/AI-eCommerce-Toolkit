<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\BillingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_subscription_created_upgrades_user_to_pro(): void
    {
        $user = User::factory()->create(['plan' => 'free', 'email' => 'buyer@example.com']);

        $service = new BillingService;
        $updated = $service->applySubscriptionWebhook([
            'meta' => [
                'event_name' => 'subscription_created',
                'custom_data' => ['user_id' => (string) $user->id],
            ],
            'data' => [
                'type' => 'subscriptions',
                'id' => '999',
                'attributes' => [
                    'status' => 'active',
                    'customer_email' => 'buyer@example.com',
                    'customer_id' => 55,
                    'renews_at' => now()->addMonth()->toIso8601String(),
                    'ends_at' => null,
                ],
            ],
        ]);

        $this->assertNotNull($updated);
        $this->assertSame('pro', $updated->plan);
        $this->assertSame('active', $updated->subscription_status);
        $this->assertSame('999', $updated->lemon_squeezy_subscription_id);
        $this->assertSame('55', $updated->lemon_squeezy_customer_id);
    }

    public function test_subscription_expired_downgrades_to_free(): void
    {
        $user = User::factory()->create([
            'plan' => 'pro',
            'lemon_squeezy_subscription_id' => '999',
            'subscription_status' => 'active',
        ]);

        $service = new BillingService;
        $updated = $service->applySubscriptionWebhook([
            'meta' => [
                'event_name' => 'subscription_expired',
            ],
            'data' => [
                'type' => 'subscriptions',
                'id' => '999',
                'attributes' => [
                    'status' => 'expired',
                    'customer_email' => $user->email,
                    'customer_id' => 55,
                    'ends_at' => now()->subDay()->toIso8601String(),
                ],
            ],
        ]);

        $this->assertSame('free', $updated->plan);
        $this->assertSame('expired', $updated->subscription_status);
    }

    public function test_cancelled_keeps_pro_until_period_ends(): void
    {
        $user = User::factory()->create([
            'plan' => 'pro',
            'lemon_squeezy_subscription_id' => '999',
        ]);

        $service = new BillingService;
        $updated = $service->applySubscriptionWebhook([
            'meta' => [
                'event_name' => 'subscription_cancelled',
            ],
            'data' => [
                'type' => 'subscriptions',
                'id' => '999',
                'attributes' => [
                    'status' => 'cancelled',
                    'user_email' => $user->email,
                    'customer_id' => 55,
                    'ends_at' => now()->addDays(10)->toIso8601String(),
                ],
            ],
        ]);

        $this->assertSame('pro', $updated->plan);
        $this->assertSame('cancelled', $updated->subscription_status);
    }
}
