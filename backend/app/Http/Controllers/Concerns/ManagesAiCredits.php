<?php

namespace App\Http\Controllers\Concerns;

use App\Models\GenerationHistory;
use App\Models\Product;

trait ManagesAiCredits
{
    private const FREE_DAILY_LIMIT = 20;

    private const FREE_MONTHLY_PRODUCTS = 50;

    protected function generationsTodayCount($user): int
    {
        return GenerationHistory::where('user_id', $user->id)
            ->whereDate('created_at', today())
            ->count();
    }

    protected function checkDailyLimit($user): void
    {
        if ($user->plan === 'pro') {
            return;
        }

        if ($this->generationsTodayCount($user) >= self::FREE_DAILY_LIMIT) {
            abort(429, 'Daily AI generation limit reached. Upgrade to Pro for unlimited access.');
        }
    }

    protected function checkMonthlyProductLimit($user): void
    {
        if ($user->plan === 'pro') {
            return;
        }

        $count = Product::where('user_id', $user->id)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        if ($count >= self::FREE_MONTHLY_PRODUCTS) {
            abort(429, 'Monthly product limit reached (50). Upgrade to Pro for unlimited products.');
        }
    }

    protected function incrementDailyUsage($user): void
    {
        $user->update([
            'ai_generations_today' => $this->generationsTodayCount($user),
            'ai_generations_date' => today()->toDateString(),
        ]);
    }

    protected function remainingGenerations($user): ?int
    {
        if ($user->plan === 'pro') {
            return null;
        }

        return max(0, self::FREE_DAILY_LIMIT - $this->generationsTodayCount($user));
    }

    protected function creditsSummary($user): array
    {
        $generationsToday = $this->generationsTodayCount($user);
        $productsThisMonth = Product::where('user_id', $user->id)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        $isPro = $user->plan === 'pro';

        return [
            'plan' => $user->plan,
            'generations_today' => $generationsToday,
            'daily_limit' => $isPro ? null : self::FREE_DAILY_LIMIT,
            'generations_remaining' => $isPro ? null : max(0, self::FREE_DAILY_LIMIT - $generationsToday),
            'products_this_month' => $productsThisMonth,
            'monthly_product_limit' => $isPro ? null : self::FREE_MONTHLY_PRODUCTS,
            'products_remaining' => $isPro ? null : max(0, self::FREE_MONTHLY_PRODUCTS - $productsThisMonth),
        ];
    }
}
