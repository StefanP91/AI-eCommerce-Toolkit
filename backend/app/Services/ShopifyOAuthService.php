<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ShopifyOAuthService
{
    public function isConfigured(): bool
    {
        return filled(config('services.shopify.api_key'))
            && filled(config('services.shopify.api_secret'));
    }

    public function normalizeShop(string $shop): string
    {
        $shop = trim(strtolower($shop));
        $shop = preg_replace('#^https?://#', '', $shop);
        $shop = rtrim($shop, '/');

        if (str_contains($shop, '/')) {
            $shop = explode('/', $shop)[0];
        }

        if (! str_ends_with($shop, '.myshopify.com')) {
            $shop = $shop.'.myshopify.com';
        }

        if (! preg_match('/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/', $shop)) {
            throw new \InvalidArgumentException('Enter a valid Shopify store domain, e.g. your-store.myshopify.com');
        }

        return $shop;
    }

    public function createState(int $userId): string
    {
        $state = Str::random(40);
        Cache::put("shopify_oauth_state:{$state}", $userId, now()->addMinutes(15));

        return $state;
    }

    public function parseState(string $state): int
    {
        $state = trim($state);
        if ($state === '') {
            throw new \RuntimeException('Invalid OAuth state.');
        }

        $userId = Cache::pull("shopify_oauth_state:{$state}");
        if ($userId === null) {
            throw new \RuntimeException('OAuth session expired. Please try connecting again.');
        }

        return (int) $userId;
    }

    public function buildAuthorizeUrl(string $shop, string $state): string
    {
        $query = http_build_query([
            'client_id' => config('services.shopify.api_key'),
            'scope' => config('services.shopify.scopes'),
            'redirect_uri' => $this->redirectUri(),
            'state' => $state,
        ]);

        return "https://{$shop}/admin/oauth/authorize?{$query}";
    }

    public function exchangeCode(string $shop, string $code): array
    {
        $response = Http::timeout(20)->post("https://{$shop}/admin/oauth/access_token", [
            'client_id' => config('services.shopify.api_key'),
            'client_secret' => config('services.shopify.api_secret'),
            'code' => $code,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Shopify authorization failed. Please try again.');
        }

        $data = $response->json();
        $token = trim((string) ($data['access_token'] ?? ''));

        if ($token === '') {
            throw new \RuntimeException('Shopify did not return an access token.');
        }

        return [
            'access_token' => $token,
            'scope' => (string) ($data['scope'] ?? ''),
        ];
    }

    public function verifyCallbackHmac(array $query): void
    {
        $hmac = (string) ($query['hmac'] ?? '');
        if ($hmac === '') {
            throw new \RuntimeException('Missing Shopify callback signature.');
        }

        $params = collect($query)
            ->except(['hmac', 'signature'])
            ->sortKeys()
            ->all();

        $encoded = urldecode(http_build_query($params));
        $calculated = hash_hmac('sha256', $encoded, (string) config('services.shopify.api_secret'));

        if (! hash_equals($hmac, $calculated)) {
            throw new \RuntimeException('Invalid Shopify callback signature.');
        }
    }

    public function redirectUri(): string
    {
        return rtrim((string) config('services.shopify.redirect_uri'), '/');
    }

    public function frontendCallbackUrl(string $status, ?string $message = null): string
    {
        $base = rtrim((string) config('app.frontend_url'), '/');
        $query = http_build_query(array_filter([
            'shopify' => $status,
            'message' => $message,
        ]));

        return "{$base}/store?{$query}";
    }
}
