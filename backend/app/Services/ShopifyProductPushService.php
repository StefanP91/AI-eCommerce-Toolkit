<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StoreConnection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

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
        $existingId = $this->resolveExistingProductId($host, $token, $product);

        if ($existingId) {
            try {
                return $this->updateProduct($host, $token, $product, $existingId);
            } catch (\RuntimeException $e) {
                if ($this->isMissingShopifyProductError($e)) {
                    return $this->createProduct($host, $token, $product);
                }

                throw $e;
            }
        }

        return $this->createProduct($host, $token, $product);
    }

    private function createProduct(string $host, string $token, Product $product): array
    {
        $response = Http::withHeaders($this->headers($token))
            ->timeout(30)
            ->post(
                $this->apiUrl($host, 'products.json'),
                ['product' => $this->platformExport->shopifyProductPayload($product)]
            );

        if (! $response->successful()) {
            throw new \RuntimeException($this->formatShopifyError($response->json('errors') ?? $response->body()));
        }

        $created = $response->json('product');
        if (! is_array($created) || empty($created['id'])) {
            throw new \RuntimeException('Shopify returned an unexpected response after creating the product.');
        }

        return [
            'action' => 'created',
            'shopify_product_id' => $created['id'],
            'admin_url' => "https://{$host}/admin/products/{$created['id']}",
            'title' => $created['title'],
            'handle' => $created['handle'],
        ];
    }

    private function updateProduct(string $host, string $token, Product $product, int $shopifyProductId): array
    {
        $payload = $this->platformExport->shopifyProductPayload($product, forUpdate: true);
        $payload['id'] = $shopifyProductId;

        $response = Http::withHeaders($this->headers($token))
            ->timeout(30)
            ->put(
                $this->apiUrl($host, "products/{$shopifyProductId}.json"),
                ['product' => $payload]
            );

        if (! $response->successful()) {
            throw new \RuntimeException($this->formatShopifyError($response->json('errors') ?? $response->body()));
        }

        $updated = $response->json('product');
        if (! is_array($updated) || empty($updated['id'])) {
            throw new \RuntimeException('Shopify returned an unexpected response after updating the product.');
        }

        $this->updateSeoMetafields($host, $token, $shopifyProductId, $product);

        return [
            'action' => 'updated',
            'shopify_product_id' => $updated['id'],
            'admin_url' => "https://{$host}/admin/products/{$updated['id']}",
            'title' => $updated['title'],
            'handle' => $updated['handle'],
        ];
    }

    private function resolveExistingProductId(string $host, string $token, Product $product): ?int
    {
        if (
            Schema::hasColumn('products', 'shopify_product_id')
            && $product->shopify_product_id
        ) {
            return (int) $product->shopify_product_id;
        }

        $urlHandle = $this->platformExport->handleFromUrl($product->product_url);
        if ($urlHandle) {
            $found = $this->findProductIdByHandle($host, $token, $urlHandle);
            if ($found) {
                return $found;
            }
        }

        $nameHandle = Str::slug((string) $product->product_name);
        if ($nameHandle !== '') {
            return $this->findProductIdByHandle($host, $token, $nameHandle);
        }

        return null;
    }

    private function findProductIdByHandle(string $host, string $token, string $handle): ?int
    {
        $response = Http::withHeaders($this->headers($token))
            ->timeout(20)
            ->get($this->apiUrl($host, 'products.json'), [
                'handle' => $handle,
                'limit' => 1,
            ]);

        if (! $response->successful()) {
            return null;
        }

        $products = $response->json('products') ?? [];

        return isset($products[0]['id']) ? (int) $products[0]['id'] : null;
    }

    private function updateSeoMetafields(string $host, string $token, int $shopifyProductId, Product $product): void
    {
        $content = $product->generated_content ?? [];
        $metaTitle = $content['meta_title'] ?? $content['seo_title'] ?? '';
        $metaDescription = $content['meta_description'] ?? '';

        if ($metaTitle !== '') {
            $this->upsertProductMetafield($host, $token, $shopifyProductId, 'title_tag', $metaTitle);
        }

        if ($metaDescription !== '') {
            $this->upsertProductMetafield($host, $token, $shopifyProductId, 'description_tag', $metaDescription);
        }
    }

    private function upsertProductMetafield(
        string $host,
        string $token,
        int $shopifyProductId,
        string $key,
        string $value,
    ): void {
        $listResponse = Http::withHeaders($this->headers($token))
            ->timeout(20)
            ->get($this->apiUrl($host, "products/{$shopifyProductId}/metafields.json"));

        if (! $listResponse->successful()) {
            return;
        }

        $existing = collect($listResponse->json('metafields') ?? [])
            ->first(fn (array $metafield) => ($metafield['namespace'] ?? '') === 'global' && ($metafield['key'] ?? '') === $key);

        if ($existing) {
            Http::withHeaders($this->headers($token))
                ->timeout(20)
                ->put($this->apiUrl($host, "metafields/{$existing['id']}.json"), [
                    'metafield' => [
                        'id' => $existing['id'],
                        'value' => $value,
                        'type' => 'single_line_text_field',
                    ],
                ]);

            return;
        }

        Http::withHeaders($this->headers($token))
            ->timeout(20)
            ->post($this->apiUrl($host, "products/{$shopifyProductId}/metafields.json"), [
                'metafield' => [
                    'namespace' => 'global',
                    'key' => $key,
                    'value' => $value,
                    'type' => 'single_line_text_field',
                ],
            ]);
    }

    private function headers(string $token): array
    {
        return [
            'X-Shopify-Access-Token' => $token,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ];
    }

    private function apiUrl(string $host, string $path): string
    {
        return "https://{$host}/admin/api/".self::API_VERSION.'/'.$path;
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

    private function isMissingShopifyProductError(\RuntimeException $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'not found')
            || str_contains($message, '404');
    }

    private function formatShopifyError(mixed $error): string
    {
        if (is_string($error) && $error !== '') {
            return 'Shopify error: '.$error;
        }

        if (is_array($error) && $error !== []) {
            return 'Shopify error: '.json_encode($error);
        }

        return 'Could not sync product on Shopify. Please try again.';
    }
}
