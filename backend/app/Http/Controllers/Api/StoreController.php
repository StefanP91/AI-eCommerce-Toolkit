<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StoreConnection;
use App\Services\StoreApiCredentialsService;
use App\Services\StoreContextAuditService;
use App\Services\StoreScanService;
use App\Services\StoreSitemapService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function __construct(
        private StoreSitemapService $sitemapService,
        private StoreScanService $scanService,
        private StoreApiCredentialsService $apiCredentialsService,
        private StoreContextAuditService $storeContextAudit,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['store' => null]);
        }

        return response()->json([
            'store' => $store->toApiArray(),
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
            'store' => $store->toApiArray(),
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
            'store' => $store->toApiArray(),
        ], $store->status === 'error' ? 422 : 200);
    }

    public function auditUrl(Request $request): JsonResponse
    {
        if ($request->user()->plan !== 'pro') {
            return response()->json([
                'message' => 'Store auditing is available on the Pro plan.',
            ], 403);
        }

        $store = StoreConnection::where('user_id', $request->user()->id)->first();
        if (! $store) {
            return response()->json(['message' => 'No store connected yet.'], 404);
        }

        $validated = $request->validate([
            'product_url' => ['required', 'url', 'max:500'],
            'bust_cache' => ['sometimes', 'boolean'],
        ]);

        try {
            $result = $this->storeContextAudit->auditUrlForUser(
                $request->user(),
                $validated['product_url'],
                (bool) ($validated['bust_cache'] ?? false),
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result);
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

    public function connectApi(Request $request): JsonResponse
    {
        if ($request->user()->plan !== 'pro') {
            return response()->json([
                'message' => 'Automatic store publishing is available on the Pro plan.',
            ], 403);
        }

        $store = StoreConnection::where('user_id', $request->user()->id)->first();
        if (! $store) {
            return response()->json(['message' => 'Connect your store URL first.'], 404);
        }

        $validated = $request->validate([
            'platform' => ['required', 'in:shopify,woocommerce'],
            'admin_access_token' => ['nullable', 'string', 'max:500'],
            'consumer_key' => ['nullable', 'string', 'max:500'],
            'consumer_secret' => ['nullable', 'string', 'max:500'],
        ]);

        $credentials = $this->apiCredentialsService->normalizeCredentials(
            $validated['platform'],
            $validated,
        );

        try {
            $this->apiCredentialsService->validate($validated['platform'], $store->store_url, $credentials);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $store->update([
            'platform' => $validated['platform'],
            'api_credentials' => $credentials,
            'api_connected_at' => now(),
        ]);

        return response()->json([
            'message' => 'Store API connected successfully. You can now push products to Shopify.',
            'store' => $store->fresh()->toApiArray(),
        ]);
    }

    public function disconnectApi(Request $request): JsonResponse
    {
        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store) {
            return response()->json(['message' => 'No store connected yet.'], 404);
        }

        $store->update([
            'platform' => null,
            'api_credentials' => null,
            'api_connected_at' => null,
        ]);

        return response()->json([
            'message' => 'Store API disconnected.',
            'store' => $store->fresh()->toApiArray(),
        ]);
    }
}
