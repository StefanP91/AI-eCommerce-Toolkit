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
        if ($request->user()->plan !== 'pro') {
            return response()->json([
                'message' => 'Store connection is available on the Pro plan.',
            ], 403);
        }

        $validated = $request->validate([
            'store_url' => ['required', 'string', 'max:500'],
            'visitor_password' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $normalizedUrl = $this->sitemapService->normalizeBaseUrl($validated['store_url']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $attributes = [
            'store_url' => $normalizedUrl,
            'status' => 'pending',
            'product_count' => 0,
            'avg_seo_score' => null,
            'error_message' => null,
        ];

        if (array_key_exists('visitor_password', $validated)) {
            $attributes['store_password'] = $validated['visitor_password'] ?: null;
        }

        $store = StoreConnection::updateOrCreate(
            ['user_id' => $request->user()->id],
            $attributes
        );

        $store = $this->scanService->scan($store);

        return response()->json([
            'message' => $store->status === 'ready'
                ? 'Store connected and scanned successfully.'
                : ($store->error_message ?? 'Store connected, but scanning failed.'),
            'store' => $this->formatStore($store),
        ], $store->status === 'error' ? 422 : 200);
    }

    public function scan(Request $request): JsonResponse
    {
        if ($request->user()->plan !== 'pro') {
            return response()->json([
                'message' => 'Store scanning is available on the Pro plan.',
            ], 403);
        }

        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['message' => 'No store connected yet.'], 404);
        }

        $validated = $request->validate([
            'visitor_password' => ['nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('visitor_password', $validated)) {
            $store->update([
                'store_password' => $validated['visitor_password'] ?: null,
            ]);
            $store->refresh();
        }

        $store = $this->scanService->scan($store);

        return response()->json([
            'message' => $store->status === 'ready'
                ? 'Store scan completed.'
                : ($store->error_message ?? 'Store scan failed.'),
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
            'has_visitor_password' => filled($store->store_password),
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
