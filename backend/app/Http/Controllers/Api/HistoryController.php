<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesAiCredits;
use App\Http\Controllers\Controller;
use App\Models\GenerationHistory;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistoryController extends Controller
{
    use ManagesAiCredits;

    public function index(Request $request): JsonResponse
    {
        $query = GenerationHistory::where('user_id', $request->user()->id)
            ->with('product:id,product_name,seo_score')
            ->latest();

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        return response()->json($query->paginate(20));
    }

    public function show(Request $request, GenerationHistory $history): JsonResponse
    {
        if ($history->user_id !== $request->user()->id) {
            abort(403);
        }

        $history->load('product');

        return response()->json($history);
    }

    public function saveProduct(Request $request, GenerationHistory $history): JsonResponse
    {
        if ($history->user_id !== $request->user()->id) {
            abort(403);
        }

        if ($history->product_id) {
            return response()->json([
                'message' => 'Already saved.',
                'product' => $history->product,
            ]);
        }

        if ($history->type !== 'product_generator') {
            return response()->json(['message' => 'Only product generations can be saved as projects.'], 422);
        }

        $data = $history->result_data ?? [];
        $input = $data['input'] ?? null;
        $content = $data['content'] ?? null;

        if (! $input || ! $content) {
            return response()->json(['message' => 'No product data found in this history entry.'], 422);
        }

        $user = $request->user();
        $this->checkMonthlyProductLimit($user);

        $product = Product::create([
            'user_id' => $user->id,
            'input_type' => $input['input_type'] ?? 'name',
            'product_name' => $input['product_name'] ?? $data['product_name'] ?? 'Untitled Product',
            'product_url' => $input['product_url'] ?? null,
            'manual_info' => $input['manual_info'] ?? null,
            'language' => $input['language'] ?? 'en',
            'tone' => $input['tone'] ?? 'professional',
            'target_country' => $input['target_country'] ?? 'US',
            'category' => $input['category'] ?? null,
            'generated_content' => $content,
            'seo_score' => $data['seo_score'] ?? $history->seo_score,
            'seo_checks' => $data['seo_checks'] ?? [],
        ]);

        $history->update(['product_id' => $product->id]);

        return response()->json([
            'message' => 'Project saved successfully.',
            'product' => $product,
            'credits' => $this->creditsSummary($user),
        ]);
    }
}
