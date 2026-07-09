<?php

namespace App\Services;

use App\Models\StoreConnection;
use Illuminate\Support\Facades\DB;

class StoreScanService
{
    private const SCAN_LIMIT = 15;

    public function __construct(
        private StoreSitemapService $sitemapService,
        private StorefrontSessionService $sessionService,
        private SeoAuditService $auditService,
    ) {}

    public function scan(StoreConnection $store): StoreConnection
    {
        $store->update([
            'status' => 'scanning',
            'error_message' => null,
        ]);

        $visitorPassword = $store->store_password;

        try {
            $baseUrl = $this->sitemapService->normalizeBaseUrl($store->store_url);
            $http = $this->sessionService->create($baseUrl, $visitorPassword);
            $urls = $this->sitemapService->discoverProductUrls(
                $store->store_url,
                self::SCAN_LIMIT,
                $visitorPassword,
                $http,
            );
        } catch (\Throwable $e) {
            $store->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
                'last_scanned_at' => now(),
            ]);

            return $store->fresh();
        }

        DB::transaction(function () use ($store, $urls, $http): void {
            $store->products()->delete();

            $scores = [];

            foreach ($urls as $url) {
                $product = $store->products()->create([
                    'url' => $url,
                    'status' => 'scanning',
                ]);

                try {
                    $audit = $this->auditService->auditUrl($url, $http, bustCache: true);
                    $score = $audit['score'];
                    $scores[] = $score;

                    $product->update([
                        'product_name' => $audit['extracted']['product_name'] ?? $this->nameFromUrl($url),
                        'seo_score' => $score,
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

            $store->update([
                'status' => 'ready',
                'product_count' => count($urls),
                'avg_seo_score' => $scores !== [] ? (int) round(array_sum($scores) / count($scores)) : null,
                'error_message' => null,
                'last_scanned_at' => now(),
            ]);
        });

        return $store->fresh(['products']);
    }

    public function rescanProductUrl(StoreConnection $store, string $url, int $attempts = 3): ?\App\Models\StoreProduct
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
                sleep(3);
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

        $this->refreshStoreAggregates($store);

        return $storeProduct->fresh();
    }

    public function findStoreProductByUrl(StoreConnection $store, string $url): ?\App\Models\StoreProduct
    {
        $target = $this->sitemapService->normalizeProductUrl($url);

        return $store->products()
            ->get()
            ->first(fn (\App\Models\StoreProduct $product) => $this->sitemapService->normalizeProductUrl($product->url) === $target);
    }

    private function refreshStoreAggregates(StoreConnection $store): void
    {
        $avgScore = $store->products()->whereNotNull('seo_score')->avg('seo_score');

        $store->update([
            'avg_seo_score' => $avgScore !== null ? (int) round($avgScore) : null,
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
