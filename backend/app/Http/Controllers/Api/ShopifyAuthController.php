<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StoreConnection;
use App\Models\User;
use App\Services\ShopifyOAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ShopifyAuthController extends Controller
{
    public function __construct(
        private ShopifyOAuthService $shopifyOAuth,
    ) {}

    public function redirect(Request $request): JsonResponse
    {
        if ($request->user()->plan !== 'pro') {
            return response()->json([
                'message' => 'Shopify OAuth connection is available on the Pro plan.',
            ], 403);
        }

        if (! $this->shopifyOAuth->isConfigured()) {
            return response()->json([
                'message' => 'Shopify OAuth is not configured on the server yet.',
            ], 503);
        }

        $validated = $request->validate([
            'shop' => ['required', 'string', 'max:255'],
        ]);

        try {
            $shop = $this->shopifyOAuth->normalizeShop($validated['shop']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $state = $this->shopifyOAuth->createState($request->user()->id);

        return response()->json([
            'authorize_url' => $this->shopifyOAuth->buildAuthorizeUrl($shop, $state),
            'shop' => $shop,
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $shop = strtolower((string) $request->query('shop', ''));
        $code = (string) $request->query('code', '');
        $state = (string) $request->query('state', '');

        try {
            if ($shop === '' || $code === '' || $state === '') {
                throw new \RuntimeException('Shopify authorization was cancelled or incomplete.');
            }

            $this->shopifyOAuth->verifyCallbackHmac($request->query());
            $shop = $this->shopifyOAuth->normalizeShop($shop);
            $userId = $this->shopifyOAuth->parseState($state);
            $user = User::query()->findOrFail($userId);

            if ($user->plan !== 'pro') {
                throw new \RuntimeException('Shopify connection requires a Pro plan.');
            }

            $token = $this->shopifyOAuth->exchangeCode($shop, $code);

            StoreConnection::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'store_url' => "https://{$shop}",
                    'platform' => 'shopify',
                    'api_credentials' => [
                        'connection_type' => 'oauth',
                        'access_token' => $token['access_token'],
                        'shop' => $shop,
                        'scope' => $token['scope'],
                    ],
                    'api_connected_at' => now(),
                    'error_message' => null,
                ]
            );

            return redirect()->away($this->shopifyOAuth->frontendCallbackUrl('connected'));
        } catch (\Throwable $e) {
            return redirect()->away(
                $this->shopifyOAuth->frontendCallbackUrl('error', $e->getMessage())
            );
        }
    }
}
