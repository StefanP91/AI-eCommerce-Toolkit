<?php

namespace App\Services;

use App\Models\StoreConnection;
use App\Models\StoreProduct;
use Illuminate\Support\Facades\DB;

class StoreScanService
{
    private const SCAN_LIMIT = 15;

    public function __construct(
        private StoreSitemapService $sitemapService,
        private SeoAuditService $auditService,
    ) {}

    public function scan(StoreConnection $store): StoreConnection
    {
        $store->update([
            'status' => 'scanning',
            'error_message' => null,
        ]);

        try {
            $urls = $this->sitemapService->discoverProductUrls($store->store_url, self::SCAN_LIMIT);
        } catch (\Throwable $e) {
            $store->update([
                'status' => 'error',
                'error_message' => $e->getMessage(),
                'last_scanned_at' => now(),
            ]);

            return $store->fresh();
        }

        DB::transaction(function () use ($store, $urls): void {
            $store->products()->delete();

            $scores = [];

            foreach ($urls as $url) {
                $product = $store->products()->create([
                    'url' => $url,
                    'status' => 'scanning',
                ]);

                try {
                    $audit = $this->auditService->auditUrl($url);
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

    private function nameFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $slug = basename(rtrim($path, '/'));

        return ucwords(str_replace(['-', '_'], ' ', $slug));
    }
}
