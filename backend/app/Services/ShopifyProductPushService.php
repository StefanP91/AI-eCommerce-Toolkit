<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StoreConnection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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
        $response = $this->shopifyRequest($token)
            ->post(
                $this->apiUrl($host, 'products.json'),
                ['product' => $this->platformExport->shopifyProductPayload($product)]
            );

        if (! $response->successful()) {
            $handle = $this->platformExport->handleFromUrl($product->product_url)
                ?? Str::slug((string) $product->product_name);

            if ($handle !== '' && $this->isDuplicateHandleError($response)) {
                $existingId = $this->findProductIdByHandle($host, $token, $handle);
                if ($existingId) {
                    return $this->updateProduct($host, $token, $product, $existingId);
                }
            }

            throw new \RuntimeException($this->formatShopifyError($response->json('errors') ?? $response->body()));
        }

        $created = $response->json('product');
        if (! is_array($created) || empty($created['id'])) {
            throw new \RuntimeException('Shopify returned an unexpected response after creating the product.');
        }

        $shopifyProductId = (int) $created['id'];

        try {
            $this->updateSeoMetafields($host, $token, $shopifyProductId, $product);
            $this->ensureProductImageWithAlt($host, $token, $shopifyProductId, $product);
        } catch (\Throwable $e) {
            Log::warning('Shopify SEO follow-up failed after product create', [
                'shopify_product_id' => $shopifyProductId,
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'action' => 'created',
            'shopify_product_id' => $shopifyProductId,
            'admin_url' => "https://{$host}/admin/products/{$created['id']}",
            'title' => $created['title'],
            'handle' => $created['handle'],
        ];
    }

    private function updateProduct(string $host, string $token, Product $product, int $shopifyProductId): array
    {
        $payload = $this->platformExport->shopifyProductPayload($product, forUpdate: true);
        $payload['id'] = $shopifyProductId;

        $response = $this->shopifyRequest($token)
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

        try {
            $this->updateSeoMetafields($host, $token, $shopifyProductId, $product);
            $this->ensureProductImageWithAlt($host, $token, $shopifyProductId, $product);
        } catch (\Throwable $e) {
            Log::warning('Shopify SEO metafield update failed after product push', [
                'shopify_product_id' => $shopifyProductId,
                'error' => $e->getMessage(),
            ]);
        }

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

        return null;
    }

    private function findProductIdByHandle(string $host, string $token, string $handle): ?int
    {
        $response = $this->shopifyRequest($token)
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
        $content = $this->platformExport->optimizedContentForPush($product);
        $metaTitle = (string) ($content['meta_title'] ?? $content['seo_title'] ?? '');
        $metaDescription = (string) ($content['meta_description'] ?? '');

        if ($metaTitle !== '') {
            $this->upsertProductMetafield($host, $token, $shopifyProductId, 'title_tag', $metaTitle);
        }

        if ($metaDescription !== '') {
            $this->upsertProductMetafield($host, $token, $shopifyProductId, 'description_tag', $metaDescription);
        }

        $legacyPayload = array_filter([
            'id' => $shopifyProductId,
            'metafields_global_title_tag' => $metaTitle !== '' ? $metaTitle : null,
            'metafields_global_description_tag' => $metaDescription !== '' ? $metaDescription : null,
        ], fn ($value) => $value !== null);

        if (count($legacyPayload) > 1) {
            $this->shopifyRequest($token)
                ->put($this->apiUrl($host, "products/{$shopifyProductId}.json"), [
                    'product' => $legacyPayload,
                ]);
        }
    }

    private function ensureProductImageWithAlt(string $host, string $token, int $shopifyProductId, Product $product): void
    {
        $content = $this->platformExport->optimizedContentForPush($product);
        $alt = trim((string) ($content['image_alt_text'] ?? ''));

        if (strlen($alt) < 10) {
            return;
        }

        $response = $this->shopifyRequest($token)
            ->get($this->apiUrl($host, "products/{$shopifyProductId}.json"), [
                'fields' => 'id,images',
            ]);

        if (! $response->successful()) {
            return;
        }

        $images = $response->json('product.images') ?? [];
        if (! is_array($images) || $images === []) {
            $this->shopifyRequest($token)
                ->put($this->apiUrl($host, "products/{$shopifyProductId}.json"), [
                    'product' => [
                        'id' => $shopifyProductId,
                        'images' => [[
                            'src' => 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png',
                            'alt' => $alt,
                        ]],
                    ],
                ]);

            return;
        }

        $payloadImages = [];
        foreach ($images as $image) {
            if (! is_array($image) || empty($image['id'])) {
                continue;
            }

            $payloadImages[] = [
                'id' => $image['id'],
                'alt' => $alt,
            ];
        }

        if ($payloadImages === []) {
            return;
        }

        $this->shopifyRequest($token)
            ->put($this->apiUrl($host, "products/{$shopifyProductId}.json"), [
                'product' => [
                    'id' => $shopifyProductId,
                    'images' => $payloadImages,
                ],
            ]);
    }

    private function upsertProductMetafield(
        string $host,
        string $token,
        int $shopifyProductId,
        string $key,
        string $value,
    ): void {
        $listResponse = $this->shopifyRequest($token)
            ->get($this->apiUrl($host, "products/{$shopifyProductId}/metafields.json"));

        if (! $listResponse->successful()) {
            Log::warning('Shopify metafield list failed', [
                'shopify_product_id' => $shopifyProductId,
                'key' => $key,
                'status' => $listResponse->status(),
                'body' => $listResponse->body(),
            ]);

            return;
        }

        $existing = collect($listResponse->json('metafields') ?? [])
            ->first(function ($metafield) use ($key) {
                if (! is_array($metafield)) {
                    return false;
                }

                return ($metafield['namespace'] ?? '') === 'global' && ($metafield['key'] ?? '') === $key;
            });

        if (is_array($existing) && ! empty($existing['id'])) {
            $updateResponse = $this->shopifyRequest($token)
                ->put($this->apiUrl($host, "metafields/{$existing['id']}.json"), [
                    'metafield' => [
                        'id' => $existing['id'],
                        'value' => $value,
                        'type' => 'single_line_text_field',
                    ],
                ]);

            if (! $updateResponse->successful()) {
                Log::warning('Shopify metafield update failed', [
                    'metafield_id' => $existing['id'],
                    'key' => $key,
                    'status' => $updateResponse->status(),
                    'body' => $updateResponse->body(),
                ]);
            }

            return;
        }

        $createResponse = $this->shopifyRequest($token)
            ->post($this->apiUrl($host, "products/{$shopifyProductId}/metafields.json"), [
                'metafield' => [
                    'namespace' => 'global',
                    'key' => $key,
                    'value' => $value,
                    'type' => 'single_line_text_field',
                ],
            ]);

        if (! $createResponse->successful()) {
            Log::warning('Shopify metafield create failed', [
                'shopify_product_id' => $shopifyProductId,
                'key' => $key,
                'status' => $createResponse->status(),
                'body' => $createResponse->body(),
            ]);
        }
    }

    private function shopifyRequest(string $token)
    {
        return Http::withHeaders($this->headers($token))
            ->timeout(30)
            ->retry(2, 500, function (\Throwable $exception) {
                return $exception instanceof ConnectionException;
            });
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

    private function isDuplicateHandleError($response): bool
    {
        $errors = $response->json('errors');
        $encoded = is_array($errors) ? json_encode($errors) : (string) $errors;

        return str_contains(strtolower($encoded), 'handle')
            && str_contains(strtolower($encoded), 'taken');
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
