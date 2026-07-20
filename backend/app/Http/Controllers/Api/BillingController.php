<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BillingService;
use App\Services\LemonSqueezyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BillingController extends Controller
{
    public function __construct(
        private LemonSqueezyService $lemonSqueezy,
        private BillingService $billing,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'configured' => $this->lemonSqueezy->isConfigured(),
            'plan' => $user->plan,
            'subscription_status' => $user->subscription_status,
            'subscription_ends_at' => $user->subscription_ends_at?->toIso8601String(),
            'has_subscription' => filled($user->lemon_squeezy_subscription_id),
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->plan === 'pro' && in_array($user->subscription_status, ['active', 'on_trial'], true)) {
            return response()->json([
                'message' => 'You already have an active Pro subscription.',
            ], 422);
        }

        try {
            $checkout = $this->lemonSqueezy->createCheckout($user);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'url' => $checkout['url'],
            'checkout_id' => $checkout['checkout_id'],
        ]);
    }

    public function portal(Request $request): JsonResponse
    {
        try {
            $url = $this->lemonSqueezy->customerPortalUrl($request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (! $url) {
            return response()->json([
                'message' => 'No Lemon Squeezy subscription found for this account yet.',
            ], 404);
        }

        return response()->json(['url' => $url]);
    }

    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $signature = $request->header('X-Signature');

        if (! $this->lemonSqueezy->verifyWebhookSignature($payload, $signature)) {
            Log::warning('Lemon Squeezy webhook signature mismatch.');

            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $data = json_decode($payload, true);
        if (! is_array($data)) {
            return response()->json(['message' => 'Invalid payload.'], 400);
        }

        $event = data_get($data, 'meta.event_name');

        if (is_string($event) && str_starts_with($event, 'subscription_')) {
            $user = $this->billing->applySubscriptionWebhook($data);
            if (! $user) {
                Log::warning('Lemon Squeezy webhook could not match a user.', [
                    'event' => $event,
                    'email' => data_get($data, 'data.attributes.user_email'),
                ]);
            }
        }

        return response()->json(['received' => true]);
    }
}
