<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesAiCredits;
use App\Http\Controllers\Controller;
use App\Models\GenerationHistory;
use App\Models\Product;
use App\Services\AiToolService;
use App\Services\ImageOptimizerService;
use App\Services\SchemaGeneratorService;
use App\Services\SeoAuditService;
use App\Services\TranslationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ToolController extends Controller
{
    use ManagesAiCredits;

    public function __construct(
        private AiToolService $toolService,
        private SeoAuditService $auditService,
        private TranslationService $translationService,
        private SchemaGeneratorService $schemaService,
        private ImageOptimizerService $imageService,
    ) {}

    public function generateTitles(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'language' => ['required', 'string', 'max:10'],
            'tone' => ['required', 'string', 'max:50'],
            'target_country' => ['required', 'string', 'max:50'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $this->checkDailyLimit($user);

        $result = $this->toolService->generateTitles($validated);

        GenerationHistory::create([
            'user_id' => $user->id,
            'type' => 'title_generator',
            'input_summary' => $validated['product_name'],
            'seo_score' => null,
            'result_data' => $result,
        ]);

        $this->incrementDailyUsage($user);

        return response()->json([
            ...$result,
            'generations_remaining' => $this->remainingGenerations($user),
        ]);
    }

    public function generateMeta(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'language' => ['required', 'string', 'max:10'],
            'tone' => ['required', 'string', 'max:50'],
            'target_country' => ['required', 'string', 'max:50'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $this->checkDailyLimit($user);

        $result = $this->toolService->generateMeta($validated);

        GenerationHistory::create([
            'user_id' => $user->id,
            'type' => 'meta_generator',
            'input_summary' => $validated['product_name'],
            'seo_score' => null,
            'result_data' => $result,
        ]);

        $this->incrementDailyUsage($user);

        return response()->json([
            ...$result,
            'generations_remaining' => $this->remainingGenerations($user),
        ]);
    }

    public function seoAudit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'audit_type' => ['required', 'in:url,manual'],
            'product_url' => ['required_if:audit_type,url', 'nullable', 'url', 'max:500'],
            'product_name' => ['required_if:audit_type,manual', 'nullable', 'string', 'max:255'],
            'page_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'h1' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'image_alt_text' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $this->checkDailyLimit($user);

        try {
            $result = $validated['audit_type'] === 'url'
                ? $this->auditService->auditUrl($validated['product_url'])
                : $this->auditService->auditManual($validated);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $inputSummary = $validated['audit_type'] === 'url'
            ? $validated['product_url']
            : ($validated['product_name'] ?? 'Manual audit');

        GenerationHistory::create([
            'user_id' => $user->id,
            'type' => 'seo_audit',
            'input_summary' => $inputSummary,
            'seo_score' => $result['score'],
            'result_data' => $result,
        ]);

        $this->incrementDailyUsage($user);

        return response()->json([
            ...$result,
            'generations_remaining' => $this->remainingGenerations($user),
        ]);
    }

    public function translate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_name' => ['required_without:product_id', 'nullable', 'string', 'max:255'],
            'source_language' => ['required', 'string', 'max:10'],
            'target_language' => ['required', 'string', 'max:10', 'different:source_language'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'short_description' => ['nullable', 'string', 'max:1000'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'image_alt_text' => ['nullable', 'string', 'max:500'],
        ]);

        if (! empty($validated['product_id'])) {
            $product = Product::where('user_id', $request->user()->id)->findOrFail($validated['product_id']);
            $validated['product_name'] = $product->product_name;
        }

        $user = $request->user();
        $this->checkDailyLimit($user);

        try {
            $result = $this->translationService->translate($validated);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        GenerationHistory::create([
            'user_id' => $user->id,
            'type' => 'translator',
            'input_summary' => ($result['product_name'] ?? 'Product')." ({$validated['source_language']} → {$validated['target_language']})",
            'seo_score' => null,
            'result_data' => $result,
        ]);

        $this->incrementDailyUsage($user);

        return response()->json([
            ...$result,
            'generations_remaining' => $this->remainingGenerations($user),
        ]);
    }

    public function generateSchema(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_name' => ['required_without:product_id', 'nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'product_url' => ['nullable', 'url', 'max:500'],
            'image_url' => ['nullable', 'url', 'max:500'],
            'sku' => ['nullable', 'string', 'max:100'],
            'brand' => ['nullable', 'string', 'max:100'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:3'],
        ]);

        if (! empty($validated['product_id'])) {
            Product::where('user_id', $request->user()->id)->findOrFail($validated['product_id']);
        }

        $result = $this->schemaService->generate($validated);

        GenerationHistory::create([
            'user_id' => $request->user()->id,
            'type' => 'schema_generator',
            'input_summary' => $result['product_name'],
            'seo_score' => null,
            'result_data' => $result,
        ]);

        return response()->json($result);
    }

    public function optimizeImage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'image' => ['nullable', 'file', 'image', 'max:5120'],
            'image_url' => ['nullable', 'url', 'max:500'],
        ]);

        if (! $request->hasFile('image') && empty($validated['image_url'])) {
            return response()->json(['message' => 'Provide an image file or image URL.'], 422);
        }

        $user = $request->user();
        $this->checkDailyLimit($user);

        try {
            $source = $request->hasFile('image')
                ? $request->file('image')
                : $validated['image_url'];
            $result = $this->imageService->analyze($source, $validated['product_name']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $historyData = $result;
        unset($historyData['optimized_image_base64']);

        GenerationHistory::create([
            'user_id' => $user->id,
            'type' => 'image_optimizer',
            'input_summary' => $validated['product_name'],
            'seo_score' => null,
            'result_data' => $historyData,
        ]);

        $this->incrementDailyUsage($user);

        return response()->json([
            ...$result,
            'generations_remaining' => $this->remainingGenerations($user),
        ]);
    }
}
