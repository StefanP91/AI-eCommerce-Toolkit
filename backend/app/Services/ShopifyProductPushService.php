<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StoreConnection;
use Illuminate\Support\Facades\Http;

class ShopifyProductPushService
{
    private const API_VERSION = '2024-10';

    public function __construct(
        private PlatformExportService $platformExport,
    ) {}

    public function push(Product $product, StoreConnection $store): array
    {
        if ($store->platform !== 'shopify') {
            throw new \InvalidArgumentException('Push to store is only supported for Shopify.');
        }

        if (! $store->hasApiConnection()) {
            throw new \InvalidArgumentException('Store API is not connected.');
        }

        $host = $this->resolveShopHost($store);
        $token = $this->resolveToken($store);

        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $token,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->timeout(30)->post(
            "https://{$host}/admin/api/".self::API_VERSION.'/products.json',
            ['product' => $this->platformExport->shopifyProductPayload($product)]
        );

        if (! $response->successful()) {
            throw new \RuntimeException($this->formatShopifyError($response->json('errors') ?? $response->body()));
        }

        $created = $response->json('product');

        return [
            'shopify_product_id' => $created['id'],
            'admin_url' => "https://{$host}/admin/products/{$created['id']}",
            'title' => $created['title'],
            'handle' => $created['handle'],
        ];
    }

    private function resolveToken(StoreConnection $store): string
    {
        $credentials = $store->api_credentials ?? [];
        $token = trim((string) ($credentials['access_token'] ?? $credentials['admin_access_token'] ?? ''));

        if ($token === '') {
            throw new \InvalidArgumentException('Shopify access token not found. Reconnect your store.');
        }

        return $token;
    }

    private function resolveShopHost(StoreConnection $store): string
    {
        $credentials = $store->api_credentials ?? [];

        if (filled($credentials['shop'] ?? null)) {
            return strtolower((string) $credentials['shop']);
        }

        $host = parse_url($store->store_url, PHP_URL_HOST);
        if (! $host || ! str_ends_with(strtolower($host), '.myshopify.com')) {
            throw new \InvalidArgumentException('Could not determine Shopify admin host. Use your myshopify.com URL.');
        }

        return strtolower($host);
    }

    private function formatShopifyError(mixed $error): string
    {
        if (is_string($error) && $error !== '') {
            return 'Shopify error: '.$error;
        }

        if (is_array($error) && $error !== []) {
            return 'Shopify error: '.json_encode($error);
        }

        return 'Could not create product on Shopify. Please try again.';
    }
}
