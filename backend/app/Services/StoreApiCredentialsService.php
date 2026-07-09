<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class StoreApiCredentialsService
{
    public function validate(string $platform, string $storeUrl, array $credentials): void
    {
        match ($platform) {
            'shopify' => $this->validateShopify($storeUrl, $credentials),
            'woocommerce' => $this->validateWooCommerce($storeUrl, $credentials),
            default => throw new \InvalidArgumentException('Unsupported platform.'),
        };
    }

    public function normalizeCredentials(string $platform, array $credentials): array
    {
        return match ($platform) {
            'shopify' => [
                'admin_access_token' => trim((string) ($credentials['admin_access_token'] ?? '')),
            ],
            'woocommerce' => [
                'consumer_key' => trim((string) ($credentials['consumer_key'] ?? '')),
                'consumer_secret' => trim((string) ($credentials['consumer_secret'] ?? '')),
            ],
            default => throw new \InvalidArgumentException('Unsupported platform.'),
        };
    }

    private function validateShopify(string $storeUrl, array $credentials): void
    {
        $token = trim((string) ($credentials['admin_access_token'] ?? ''));
        if ($token === '') {
            throw new \InvalidArgumentException('Shopify Admin API access token is required.');
        }

        $host = $this->shopifyAdminHost($storeUrl);
        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $token,
            'Accept' => 'application/json',
        ])->timeout(20)->get("https://{$host}/admin/api/2024-10/shop.json");

        if (! $response->successful()) {
            throw new \RuntimeException('Could not verify Shopify credentials. Check the token and app permissions (read_products, write_products).');
        }
    }

    private function validateWooCommerce(string $storeUrl, array $credentials): void
    {
        $key = trim((string) ($credentials['consumer_key'] ?? ''));
        $secret = trim((string) ($credentials['consumer_secret'] ?? ''));

        if ($key === '' || $secret === '') {
            throw new \InvalidArgumentException('WooCommerce consumer key and secret are required.');
        }

        $base = rtrim($storeUrl, '/');
        $response = Http::withBasicAuth($key, $secret)
            ->timeout(20)
            ->get("{$base}/wp-json/wc/v3/products", ['per_page' => 1]);

        if (! $response->successful()) {
            throw new \RuntimeException('Could not verify WooCommerce credentials. Check the REST API keys and store URL.');
        }
    }

    private function shopifyAdminHost(string $storeUrl): string
    {
        $host = parse_url($storeUrl, PHP_URL_HOST);
        if (! $host) {
            throw new \InvalidArgumentException('Invalid Shopify store URL.');
        }

        $host = strtolower($host);
        if (! str_ends_with($host, '.myshopify.com')) {
            throw new \InvalidArgumentException('Shopify API setup requires your myshopify.com store URL.');
        }

        return $host;
    }
}
