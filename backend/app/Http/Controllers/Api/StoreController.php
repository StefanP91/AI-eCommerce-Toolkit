<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StoreConnection;
use App\Services\StoreScanService;
use App\Services\StoreSitemapService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function __construct(
        private StoreSitemapService $sitemapService,
        private StoreScanService $scanService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['store' => null]);
        }

        return response()->json([
            'store' => $this->formatStore($store),
        ]);
    }

    public function connect(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store_url' => ['required', 'string', 'max:500'],
        ]);

        try {
            $normalizedUrl = $this->sitemapService->normalizeBaseUrl($validated['store_url']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $store = StoreConnection::updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'store_url' => $normalizedUrl,
                'status' => 'pending',
                'product_count' => 0,
                'avg_seo_score' => null,
                'error_message' => null,
            ]
        );

        $store = $this->scanService->scan($store);

        return response()->json([
            'message' => $store->status === 'ready'
                ? 'Store connected and scanned successfully.'
                : 'Store connected, but scanning failed.',
            'store' => $this->formatStore($store),
        ], $store->status === 'error' ? 422 : 200);
    }

    public function scan(Request $request): JsonResponse
    {
        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['message' => 'No store connected yet.'], 404);
        }

        $store = $this->scanService->scan($store);

        return response()->json([
            'message' => $store->status === 'ready'
                ? 'Store scan completed.'
                : 'Store scan failed.',
            'store' => $this->formatStore($store),
        ], $store->status === 'error' ? 422 : 200);
    }

    public function products(Request $request): JsonResponse
    {
        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['message' => 'No store connected yet.'], 404);
        }

        $products = $store->products()
            ->orderByDesc('seo_score')
            ->paginate(20);

        return response()->json($products);
    }

    public function destroy(Request $request): JsonResponse
    {
        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['message' => 'No store connected yet.'], 404);
        }

        $store->delete();

        return response()->json(['message' => 'Store disconnected.']);
    }

    private function formatStore(StoreConnection $store): array
    {
        $optimizedCount = $store->products()->where('seo_score', '>=', 80)->count();
        $needsWorkCount = $store->products()->where('seo_score', '<', 60)->count();

        return [
            'id' => $store->id,
            'store_url' => $store->store_url,
            'status' => $store->status,
            'product_count' => $store->product_count,
            'avg_seo_score' => $store->avg_seo_score,
            'optimized_count' => $optimizedCount,
            'needs_work_count' => $needsWorkCount,
            'last_scanned_at' => $store->last_scanned_at?->toIso8601String(),
            'error_message' => $store->error_message,
        ];
    }
}
