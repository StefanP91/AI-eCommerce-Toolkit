<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesAiCredits;
use App\Http\Controllers\Controller;
use App\Models\GenerationHistory;
use App\Models\Product;
use App\Models\StoreConnection;
use App\Services\AiProductService;
use App\Services\PlatformExportService;
use App\Services\ProductExportService;
use App\Services\SeoContentOptimizerService;
use App\Services\SeoScoreService;
use App\Services\ShopifyProductPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ManagesAiCredits;

    public function __construct(
        private AiProductService $aiService,
        private SeoScoreService $seoService,
        private SeoContentOptimizerService $optimizer,
        private ProductExportService $exportService,
        private PlatformExportService $platformExportService,
        private ShopifyProductPushService $shopifyPushService,
    ) {}

    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'input_type' => ['required', 'in:name,url,manual'],
            'product_name' => ['required_if:input_type,name', 'nullable', 'string', 'max:255'],
            'product_url' => ['required_if:input_type,url', 'nullable', 'url', 'max:500'],
            'manual_info' => ['required_if:input_type,manual', 'nullable', 'string', 'max:5000'],
            'language' => ['required', 'string', 'max:10'],
            'tone' => ['required', 'string', 'max:50'],
            'target_country' => ['required', 'string', 'max:50'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $this->checkDailyLimit($user);

        try {
            $content = $this->aiService->generate($validated);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (empty($validated['product_name'])) {
            $validated['product_name'] = $this->nameFromUrl($validated['product_url'] ?? null)
                ?? strtok($content['seo_title'] ?? '', ' |');
        }

        $content = $this->optimizer->optimize($content, [
            'product_name' => $validated['product_name'] ?? $this->nameFromUrl($validated['product_url'] ?? null),
            'category' => $validated['category'] ?? 'General',
            'target_country' => $validated['target_country'],
            'tone' => $validated['tone'],
        ]);

        $seo = $this->seoService->calculate($content);

        $inputSummary = $validated['product_name']
            ?? $validated['product_url']
            ?? substr($validated['manual_info'] ?? '', 0, 100);

        $history = GenerationHistory::create([
            'user_id' => $user->id,
            'type' => 'product_generator',
            'input_summary' => $inputSummary,
            'seo_score' => $seo['score'],
            'result_data' => [
                'input' => $validated,
                'content' => $content,
                'seo_score' => $seo['score'],
                'seo_checks' => $seo['checks'],
            ],
        ]);

        $this->incrementDailyUsage($user);

        return response()->json([
            'content' => $content,
            'seo_score' => $seo['score'],
            'seo_checks' => $seo['checks'],
            'product_name' => $validated['product_name'],
            'input' => $validated,
            'history_id' => $history->id,
            'saved' => false,
            'generations_remaining' => $this->remainingGenerations($user),
            'credits' => $this->creditsSummary($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'input_type' => ['required', 'in:name,url,manual'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'product_url' => ['nullable', 'url', 'max:500'],
            'manual_info' => ['nullable', 'string', 'max:5000'],
            'language' => ['required', 'string', 'max:10'],
            'tone' => ['required', 'string', 'max:50'],
            'target_country' => ['required', 'string', 'max:50'],
            'category' => ['nullable', 'string', 'max:100'],
            'generated_content' => ['required', 'array'],
            'seo_score' => ['required', 'integer', 'min:0', 'max:100'],
            'seo_checks' => ['required', 'array'],
            'history_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $this->checkMonthlyProductLimit($user);

        $historyId = $validated['history_id'] ?? null;
        unset($validated['history_id']);

        $product = Product::create([
            'user_id' => $user->id,
            'input_type' => $validated['input_type'],
            'product_name' => $validated['product_name'],
            'product_url' => $validated['product_url'] ?? null,
            'manual_info' => $validated['manual_info'] ?? null,
            'language' => $validated['language'],
            'tone' => $validated['tone'],
            'target_country' => $validated['target_country'],
            'category' => $validated['category'] ?? null,
            'generated_content' => $validated['generated_content'],
            'seo_score' => $validated['seo_score'],
            'seo_checks' => $validated['seo_checks'],
        ]);

        if ($historyId) {
            GenerationHistory::where('user_id', $user->id)
                ->where('id', $historyId)
                ->whereNull('product_id')
                ->update(['product_id' => $product->id]);
        }

        return response()->json([
            'product' => $product,
            'message' => 'Project saved successfully.',
            'credits' => $this->creditsSummary($user),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $products = Product::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        return response()->json($products);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            abort(403);
        }

        return response()->json($product);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            abort(403);
        }

        $product->delete();

        return response()->json(['message' => 'Project deleted successfully.']);
    }

    public function export(Request $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            abort(403);
        }

        $format = $request->query('format', 'txt');

        return match ($format) {
            'csv' => response()->json([
                'content' => $this->exportService->toCsv($product),
                'filename' => 'product-'.$product->id.'.csv',
                'mime' => 'text/csv',
            ]),
            'shopify' => response()->json([
                'content' => $this->platformExportService->toShopifyCsv($product),
                'filename' => 'shopify-product-'.$product->id.'.csv',
                'mime' => 'text/csv',
            ]),
            'woocommerce' => response()->json([
                'content' => $this->platformExportService->toWooCommerceCsv($product),
                'filename' => 'woocommerce-product-'.$product->id.'.csv',
                'mime' => 'text/csv',
            ]),
            'bigcommerce' => response()->json([
                'content' => $this->platformExportService->toBigCommerceCsv($product),
                'filename' => 'bigcommerce-product-'.$product->id.'.csv',
                'mime' => 'text/csv',
            ]),
            'excel' => response()->json([
                'content' => $this->exportService->toExcelXml($product),
                'filename' => 'product-'.$product->id.'.xls',
                'mime' => 'application/vnd.ms-excel',
            ]),
            'json' => response()->json([
                'content' => json_encode([
                    'product' => $product->only(['id', 'product_name', 'seo_score', 'created_at']),
                    'content' => $product->generated_content,
                ], JSON_PRETTY_PRINT),
                'filename' => 'product-'.$product->id.'.json',
                'mime' => 'application/json',
            ]),
            default => response()->json([
                'content' => $this->formatAsText($product->generated_content ?? [], $product),
                'filename' => 'product-'.$product->id.'.txt',
                'mime' => 'text/plain',
            ]),
        };
    }

    public function pushToStore(Request $request, Product $product): JsonResponse
    {
        if ($product->user_id !== $request->user()->id) {
            abort(403);
        }

        if ($request->user()->plan !== 'pro') {
            return response()->json([
                'message' => 'Push to store is available on the Pro plan.',
            ], 403);
        }

        $store = StoreConnection::where('user_id', $request->user()->id)->first();

        if (! $store || ! $store->hasApiConnection()) {
            return response()->json([
                'message' => 'Connect your store API or Shopify OAuth first.',
            ], 422);
        }

        if ($store->platform !== 'shopify') {
            return response()->json([
                'message' => 'One-click push is currently supported for Shopify only.',
            ], 422);
        }

        try {
            $result = $this->shopifyPushService->push($product, $store);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Product published to Shopify successfully.',
            'shopify' => $result,
        ]);
    }

    public function exportAll(Request $request): JsonResponse
    {
        $format = $request->query('format', 'csv');
        $products = Product::where('user_id', $request->user()->id)->latest()->get();

        if ($products->isEmpty()) {
            return response()->json(['message' => 'No projects to export.'], 422);
        }

        if ($format === 'excel' && $products->count() === 1) {
            return response()->json([
                'content' => $this->exportService->toExcelXml($products->first()),
                'filename' => 'all-products.xls',
                'mime' => 'application/vnd.ms-excel',
            ]);
        }

        $bulk = match ($format) {
            'shopify' => [
                'content' => $this->platformExportService->bulkShopifyCsv($products),
                'filename' => 'shopify-products.csv',
            ],
            'woocommerce' => [
                'content' => $this->platformExportService->bulkWooCommerceCsv($products),
                'filename' => 'woocommerce-products.csv',
            ],
            'bigcommerce' => [
                'content' => $this->platformExportService->bulkBigCommerceCsv($products),
                'filename' => 'bigcommerce-products.csv',
            ],
            default => [
                'content' => $this->exportService->bulkCsv($products),
                'filename' => 'all-products.csv',
            ],
        };

        return response()->json([
            'content' => $bulk['content'],
            'filename' => $bulk['filename'],
            'mime' => 'text/csv',
        ]);
    }

    private function formatAsText(array $content, Product $product): string
    {
        $lines = [
            '=== AI Commerce Suite - Product Export ===',
            'Product: '.($product->product_name ?? 'N/A'),
            'SEO Score: '.($product->seo_score ?? 'N/A').'/100',
            '',
            '--- SEO Title ---',
            $content['seo_title'] ?? '',
            '',
            '--- Product Description ---',
            $content['description'] ?? '',
            '',
            '--- Short Description ---',
            $content['short_description'] ?? '',
            '',
            '--- Meta Title ---',
            $content['meta_title'] ?? '',
            '',
            '--- Meta Description ---',
            $content['meta_description'] ?? '',
            '',
            '--- Image Alt Text ---',
            $content['image_alt_text'] ?? '',
            '',
            '--- Keywords ---',
            implode(', ', $content['keywords'] ?? []),
            '',
            '--- Tags ---',
            implode(', ', $content['tags'] ?? []),
            '',
            '--- Features ---',
        ];

        foreach ($content['features'] ?? [] as $feature) {
            $lines[] = '• '.$feature;
        }

        $lines[] = '';
        $lines[] = '--- Benefits ---';
        foreach ($content['benefits'] ?? [] as $benefit) {
            $lines[] = '• '.$benefit;
        }

        $lines[] = '';
        $lines[] = '--- FAQs ---';
        foreach ($content['faqs'] ?? [] as $faq) {
            $lines[] = 'Q: '.($faq['question'] ?? '');
            $lines[] = 'A: '.($faq['answer'] ?? '');
            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    private function nameFromUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $slug = basename(rtrim($path, '/'));

        return ucwords(str_replace(['-', '_'], ' ', $slug));
    }
}
