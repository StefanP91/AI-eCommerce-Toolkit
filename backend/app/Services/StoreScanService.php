<?php

namespace App\Services;

use App\Models\StoreConnection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class StoreScanService
{
    public const SCAN_BATCH_SIZE = 50;

    public function __construct(
        private StoreSitemapService $sitemapService,
        private StorefrontSessionService $sessionService,
        private SeoAuditService $auditService,
    ) {}

    public function discoverCatalog(StoreConnection $store): StoreConnection
    {
        $visitorPassword = $store->store_password;

        try {
            $catalogUrls = $this->fetchCatalogUrls($store->store_url, $visitorPassword);

            $store->update([
                'catalog_urls' => $catalogUrls,
                'catalog_product_count' => count($catalogUrls),
                'product_count' => 0,
                'avg_seo_score' => null,
                'status' => 'pending',
                'error_message' => null,
            ]);
        } catch (\Throwable $e) {
            $store->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
                'last_scanned_at' => now(),
            ]);
        }

        return $store->fresh();
    }

    public function scan(StoreConnection $store, bool $append = false): StoreConnection
    {
        @set_time_limit(600);

        $store->update([
            'status' => 'scanning',
            'error_message' => null,
        ]);

        $visitorPassword = $store->store_password;

        try {
            $catalogUrls = $this->resolveCatalogUrls($store, $append, $visitorPassword);
        } catch (\Throwable $e) {
            $store->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
                'last_scanned_at' => now(),
            ]);

            return $store->fresh();
        }

        $catalogProductCount = count($catalogUrls);

        if ($append) {
            $existing = $store->products()
                ->pluck('url')
                ->map(fn (string $url) => $this->sitemapService->normalizeProductUrl($url))
                ->all();

            $catalogUrls = array_values(array_filter(
                $catalogUrls,
                fn (string $url) => ! in_array($this->sitemapService->normalizeProductUrl($url), $existing, true),
            ));
        } else {
            $store->products()->delete();
        }

        $urls = array_slice($catalogUrls, 0, self::SCAN_BATCH_SIZE);

        if ($urls === []) {
            $scannedCount = $store->products()->count();
            $scanComplete = $scannedCount >= $catalogProductCount;

            $store->update([
                'status' => $scanComplete ? 'ready' : 'scanning',
                'catalog_product_count' => $catalogProductCount,
                'product_count' => $scannedCount,
                'error_message' => null,
                'last_scanned_at' => now(),
            ]);

            return $store->fresh(['products']);
        }

        $baseUrl = $this->sitemapService->normalizeBaseUrl($store->store_url);
        $http = $this->sessionService->create($baseUrl, $visitorPassword);

        DB::transaction(function () use ($store, $urls, $http, $catalogProductCount): void {
            foreach ($urls as $url) {
                try {
                    $product = $store->products()->create([
                        'url' => $url,
                        'status' => 'scanning',
                    ]);
                } catch (UniqueConstraintViolationException) {
                    continue;
                }

                try {
                    $audit = $this->auditService->auditUrl($url, $http, bustCache: true);
                    $product->update([
                        'product_name' => $audit['extracted']['product_name'] ?? $this->nameFromUrl($url),
                        'seo_score' => $audit['score'],
                        'seo_checks' => $audit['checks'],
                        'status' => 'scanned',
                        'error_message' => null,
                        'last_scanned_at' => now(),
                    ]);
                } catch (\Throwable $e) {
                    $product->update([
                        'product_name' => $this->nameFromUrl($url),
                        'status' => 'error',
                        'error_message' => $e->getMessage(),
                        'last_scanned_at' => now(),
                    ]);
                }
            }

            $avgScore = $store->products()->whereNotNull('seo_score')->avg('seo_score');
            $scannedCount = $store->products()->count();
            $scanComplete = $scannedCount >= $catalogProductCount;

            $store->update([
                'status' => $scanComplete ? 'ready' : 'scanning',
                'catalog_product_count' => $catalogProductCount,
                'product_count' => $scannedCount,
                'avg_seo_score' => $avgScore !== null ? (int) round($avgScore) : null,
                'error_message' => null,
                'last_scanned_at' => now(),
            ]);
        });

        return $store->fresh(['products']);
    }

    /**
     * @return list<string>
     */
    private function resolveCatalogUrls(StoreConnection $store, bool $append, ?string $visitorPassword): array
    {
        $cached = $store->catalog_urls;

        if ($append && is_array($cached) && $cached !== []) {
            return array_values($cached);
        }

        $catalogUrls = $this->fetchCatalogUrls($store->store_url, $visitorPassword);

        $store->update([
            'catalog_urls' => $catalogUrls,
            'catalog_product_count' => count($catalogUrls),
        ]);

        return $catalogUrls;
    }

    /**
     * @return list<string>
     */
    private function fetchCatalogUrls(string $storeUrl, ?string $visitorPassword): array
    {
        $baseUrl = $this->sitemapService->normalizeBaseUrl($storeUrl);
        $http = $this->sessionService->create($baseUrl, $visitorPassword);

        return $this->sitemapService->discoverProductUrls(
            $storeUrl,
            0,
            $visitorPassword,
            $http,
        );
    }

    public function rescanProductUrl(StoreConnection $store, string $url, int $attempts = 5): ?\App\Models\StoreProduct
    {
        $storeProduct = $this->findStoreProductByUrl($store, $url);

        if (! $storeProduct) {
            $storeProduct = $store->products()->create([
                'url' => $url,
                'status' => 'scanning',
            ]);
        }

        $baseUrl = $this->sitemapService->normalizeBaseUrl($store->store_url);
        $http = $this->sessionService->create($baseUrl, $store->store_password);

        $audit = null;
        $lastError = null;

        for ($attempt = 1; $attempt <= max(1, $attempts); $attempt++) {
            if ($attempt > 1) {
                sleep(5);
            }

            try {
                $audit = $this->auditService->auditUrl($url, $http, bustCache: true);
                $lastError = null;

                if ($audit['score'] >= 90 || $attempt === $attempts) {
                    break;
                }
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
            }
        }

        if (! is_array($audit)) {
            $storeProduct->update([
                'status' => 'error',
                'error_message' => $lastError ?? 'Could not audit product page after push.',
                'last_scanned_at' => now(),
            ]);

            return $storeProduct->fresh();
        }

        $storeProduct->update([
            'product_name' => $audit['extracted']['product_name'] ?? $storeProduct->product_name ?? $this->nameFromUrl($url),
            'seo_score' => $audit['score'],
            'seo_checks' => $audit['checks'],
            'status' => 'scanned',
            'error_message' => null,
            'last_scanned_at' => now(),
        ]);

        $fresh = $storeProduct->fresh();
        $this->syncDuplicateStoreProductsByUrl($store, $url, $fresh);

        $this->refreshStoreAggregates($store);

        return $fresh;
    }

    public function syncDuplicateStoreProductsByUrl(
        StoreConnection $store,
        string $url,
        \App\Models\StoreProduct $source,
    ): void {
        foreach ($this->findAllStoreProductsByUrl($store, $url) as $duplicate) {
            if ($duplicate->id === $source->id) {
                continue;
            }

            $duplicate->update([
                'seo_score' => $source->seo_score,
                'seo_checks' => $source->seo_checks,
                'status' => $source->status,
                'error_message' => $source->error_message,
                'last_scanned_at' => $source->last_scanned_at,
            ]);
        }
    }

    public function findStoreProductByUrl(StoreConnection $store, string $url): ?\App\Models\StoreProduct
    {
        return $this->findAllStoreProductsByUrl($store, $url)[0] ?? null;
    }

    public function findAllStoreProductsByUrl(StoreConnection $store, string $url): array
    {
        $target = $this->sitemapService->normalizeProductUrl($url);

        return $store->products()
            ->get()
            ->filter(fn (\App\Models\StoreProduct $product) => $this->sitemapService->normalizeProductUrl($product->url) === $target)
            ->values()
            ->all();
    }

    private function refreshStoreAggregates(StoreConnection $store): void
    {
        $avgScore = $store->products()->whereNotNull('seo_score')->avg('seo_score');

        $store->update([
            'avg_seo_score' => $avgScore !== null ? (int) round($avgScore) : null,
            'product_count' => $store->products()->count(),
            'last_scanned_at' => now(),
        ]);
    }

    private function nameFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $slug = basename(rtrim($path, '/'));

        return ucwords(str_replace(['-', '_'], ' ', $slug));
    }
}
