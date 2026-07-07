<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesAiCredits;
use App\Http\Controllers\Controller;
use App\Models\GenerationHistory;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
  use ManagesAiCredits;

  public function stats(Request $request): JsonResponse
  {
    $user = $request->user();

    $dailyLimit = $user->plan === 'pro' ? null : 20;

    return response()->json([
      'total_products' => Product::where('user_id', $user->id)->count(),
      'total_generations' => GenerationHistory::where('user_id', $user->id)->count(),
      'generations_today' => $this->generationsTodayCount($user),
      'daily_limit' => $dailyLimit,
      'plan' => $user->plan,
      'products_this_month' => Product::where('user_id', $user->id)
        ->whereMonth('created_at', now()->month)
        ->whereYear('created_at', now()->year)
        ->count(),
      'monthly_product_limit' => $user->plan === 'pro' ? null : 50,
      'recent_products' => Product::where('user_id', $user->id)
        ->latest()
        ->limit(5)
        ->get(['id', 'product_name', 'seo_score', 'created_at']),
      'recent_history' => GenerationHistory::where('user_id', $user->id)
        ->latest()
        ->limit(5)
        ->get(['id', 'input_summary', 'seo_score', 'created_at']),
    ]);
  }
}
