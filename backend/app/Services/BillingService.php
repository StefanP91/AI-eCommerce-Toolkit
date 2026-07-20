<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

class BillingService
{
    /**
     * Active-like statuses that grant Pro access.
     *
     * @var list<string>
     */
    private const ACTIVE_STATUSES = [
        'active',
        'on_trial',
        'paused',
        'past_due',
    ];

    public function applySubscriptionWebhook(array $payload): ?User
    {
        $event = data_get($payload, 'meta.event_name');
        $data = data_get($payload, 'data');

        if (! is_array($data) || ($data['type'] ?? null) !== 'subscriptions') {
            return null;
        }

        $attributes = $data['attributes'] ?? [];
        $user = $this->resolveUser($payload, $attributes);

        if (! $user) {
            return null;
        }

        $status = (string) ($attributes['status'] ?? '');
        $endsAt = $attributes['ends_at'] ?? null;
        $renewsAt = $attributes['renews_at'] ?? null;

        $user->fill([
            'lemon_squeezy_customer_id' => isset($attributes['customer_id'])
                ? (string) $attributes['customer_id']
                : $user->lemon_squeezy_customer_id,
            'lemon_squeezy_subscription_id' => isset($data['id'])
                ? (string) $data['id']
                : $user->lemon_squeezy_subscription_id,
            'subscription_status' => $status !== '' ? $status : $user->subscription_status,
            'subscription_ends_at' => $endsAt
                ? Carbon::parse($endsAt)
                : ($renewsAt ? Carbon::parse($renewsAt) : $user->subscription_ends_at),
        ]);

        $user->plan = $this->planForStatus($status, $event, $user->subscription_ends_at);
        $user->save();

        return $user->fresh();
    }

    private function resolveUser(array $payload, array $attributes): ?User
    {
        $customUserId = data_get($payload, 'meta.custom_data.user_id');

        if (filled($customUserId)) {
            $user = User::find($customUserId);
            if ($user) {
                return $user;
            }
        }

        $subscriptionId = data_get($payload, 'data.id');
        if (filled($subscriptionId)) {
            $user = User::where('lemon_squeezy_subscription_id', (string) $subscriptionId)->first();
            if ($user) {
                return $user;
            }
        }

        $customerId = $attributes['customer_id'] ?? null;
        if (filled($customerId)) {
            $user = User::where('lemon_squeezy_customer_id', (string) $customerId)->first();
            if ($user) {
                return $user;
            }
        }

        $email = $attributes['user_email'] ?? null;
        if (filled($email)) {
            return User::where('email', $email)->first();
        }

        return null;
    }

    private function planForStatus(string $status, mixed $event, mixed $endsAt = null): string
    {
        if (in_array($status, self::ACTIVE_STATUSES, true)) {
            return 'pro';
        }

        // Cancelled but paid through the current period
        if ($status === 'cancelled' && $endsAt instanceof Carbon && $endsAt->isFuture()) {
            return 'pro';
        }

        $event = (string) $event;
        if (in_array($event, ['subscription_expired'], true)) {
            return 'free';
        }

        if (in_array($status, ['cancelled', 'expired', 'unpaid'], true)) {
            return 'free';
        }

        return 'free';
    }
}
