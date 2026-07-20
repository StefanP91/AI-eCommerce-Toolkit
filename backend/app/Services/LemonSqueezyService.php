<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class LemonSqueezyService
{
    private const API_BASE = 'https://api.lemonsqueezy.com/v1';

    public function isConfigured(): bool
    {
        return filled(config('services.lemon_squeezy.api_key'))
            && filled($this->storeId())
            && filled($this->variantId());
    }

    public function createCheckout(User $user): array
    {
        if (! $this->isConfigured()) {
            throw new \RuntimeException('Lemon Squeezy billing is not configured yet.');
        }

        $frontend = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $storeId = $this->storeId();
        $variantId = $this->variantId();

        $payload = [
            'data' => [
                'type' => 'checkouts',
                'attributes' => [
                    'checkout_data' => [
                        'email' => $user->email,
                        'name' => $user->name,
                        'custom' => [
                            'user_id' => (string) $user->id,
                        ],
                    ],
                    'product_options' => [
                        'redirect_url' => $frontend.'/pricing?checkout=success',
                    ],
                    'checkout_options' => [
                        'embed' => false,
                        'media' => false,
                        'logo' => true,
                    ],
                ],
                'relationships' => [
                    'store' => [
                        'data' => [
                            'type' => 'stores',
                            'id' => $storeId,
                        ],
                    ],
                    'variant' => [
                        'data' => [
                            'type' => 'variants',
                            'id' => $variantId,
                        ],
                    ],
                ],
            ],
        ];

        try {
            $response = Http::withToken(config('services.lemon_squeezy.api_key'))
                ->accept('application/vnd.api+json')
                ->withHeaders(['Content-Type' => 'application/vnd.api+json'])
                ->post(self::API_BASE.'/checkouts', $payload)
                ->throw()
                ->json();
        } catch (RequestException $e) {
            $message = $e->response?->json('errors.0.detail')
                ?? $e->response?->json('message')
                ?? 'Could not create Lemon Squeezy checkout.';

            throw new \RuntimeException($message, previous: $e);
        }

        $url = data_get($response, 'data.attributes.url');

        if (! filled($url)) {
            throw new \RuntimeException('Lemon Squeezy checkout URL was missing from the response.');
        }

        return [
            'url' => $url,
            'checkout_id' => data_get($response, 'data.id'),
        ];
    }

    public function getSubscription(string $subscriptionId): array
    {
        try {
            return Http::withToken(config('services.lemon_squeezy.api_key'))
                ->accept('application/vnd.api+json')
                ->get(self::API_BASE.'/subscriptions/'.$subscriptionId)
                ->throw()
                ->json();
        } catch (RequestException $e) {
            $message = $e->response?->json('errors.0.detail')
                ?? 'Could not load Lemon Squeezy subscription.';

            throw new \RuntimeException($message, previous: $e);
        }
    }

    public function customerPortalUrl(User $user): ?string
    {
        if (! filled($user->lemon_squeezy_subscription_id) || ! $this->isConfigured()) {
            return null;
        }

        $subscription = $this->getSubscription($user->lemon_squeezy_subscription_id);

        return data_get($subscription, 'data.attributes.urls.customer_portal');
    }

    public function verifyWebhookSignature(string $payload, ?string $signature): bool
    {
        $secret = (string) config('services.lemon_squeezy.webhook_secret');

        if ($secret === '' || $signature === null || $signature === '') {
            return false;
        }

        $digest = hash_hmac('sha256', $payload, $secret);

        return hash_equals($digest, $signature);
    }

    private function storeId(): string
    {
        return preg_replace('/\D+/', '', (string) config('services.lemon_squeezy.store_id')) ?: '';
    }

    private function variantId(): string
    {
        return preg_replace('/\D+/', '', (string) config('services.lemon_squeezy.variant_id')) ?: '';
    }
}
