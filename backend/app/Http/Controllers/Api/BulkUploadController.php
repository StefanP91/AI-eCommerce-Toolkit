<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesAiCredits;
use App\Http\Controllers\Controller;
use App\Models\BulkUpload;
use App\Services\BulkUploadService;
use App\Services\ProductImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class BulkUploadController extends Controller
{
    use ManagesAiCredits;

    public function __construct(
        private ProductImportService $importService,
        private BulkUploadService $bulkService,
    ) {}

    public function template(): \Symfony\Component\HttpFoundation\Response
    {
        return Response::make($this->importService->templateCsv(), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="bulk-upload-template.csv"',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'language' => ['required', 'string', 'max:10'],
            'tone' => ['required', 'string', 'max:50'],
            'target_country' => ['required', 'string', 'max:50'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $file = $request->file('file');
        $contents = file_get_contents($file->getRealPath());

        try {
            $rows = $this->importService->parseFile($contents, $file->getClientOriginalName());
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $defaults = [
            'language' => $validated['language'],
            'tone' => $validated['tone'],
            'target_country' => $validated['target_country'],
            'category' => $validated['category'] ?? 'General',
        ];

        $bulkUpload = BulkUpload::create([
            'user_id' => $request->user()->id,
            'filename' => $file->getClientOriginalName(),
            'status' => 'pending',
            'total_rows' => count($rows),
            'defaults' => $defaults,
        ]);

        foreach ($rows as $row) {
            $merged = $this->bulkService->applyDefaults($row, $defaults);

            $bulkUpload->items()->create([
                'row_number' => $merged['row_number'],
                'input_type' => $merged['input_type'],
                'product_name' => $merged['product_name'],
                'product_url' => $merged['product_url'],
                'manual_info' => $merged['manual_info'],
                'language' => $merged['language'],
                'tone' => $merged['tone'],
                'target_country' => $merged['target_country'],
                'category' => $merged['category'],
            ]);
        }

        $items = $bulkUpload->items()->orderBy('row_number')->get();

        return response()->json([
            'bulk_upload' => $bulkUpload,
            'items' => $items,
            'preview' => $items->take(10)->values(),
            'max_rows' => ProductImportService::MAX_ROWS,
        ], 201);
    }

    public function show(Request $request, BulkUpload $bulkUpload): JsonResponse
    {
        $this->authorizeBulkUpload($request, $bulkUpload);

        $bulkUpload->load(['items' => fn ($q) => $q->orderBy('row_number')->with('product:id,product_name,seo_score')]);

        return response()->json($bulkUpload);
    }

    public function processNext(Request $request, BulkUpload $bulkUpload): JsonResponse
    {
        $this->authorizeBulkUpload($request, $bulkUpload);

        if ($bulkUpload->status === 'completed') {
            return response()->json([
                'message' => 'Bulk upload already completed.',
                'bulk_upload' => $bulkUpload,
                'done' => true,
            ]);
        }

        $user = $request->user();

        try {
            $this->checkDailyLimit($user);
            $this->checkMonthlyProductLimit($user);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->refreshBulkStatus($bulkUpload);

            return response()->json([
                'message' => $e->getMessage(),
                'bulk_upload' => $bulkUpload->fresh(),
                'done' => true,
                'limit_reached' => true,
            ], $e->getStatusCode());
        }

        $result = $this->bulkService->processNextItem($bulkUpload, $user);

        if ($result === null) {
            return response()->json([
                'bulk_upload' => $bulkUpload->fresh(),
                'done' => true,
                'credits' => $this->creditsSummary($user),
            ]);
        }

        if ($result['item']->status === 'completed') {
            $this->incrementDailyUsage($user);
        }

        $bulkUpload = $result['bulk_upload'];
        $pending = $bulkUpload->items()->where('status', 'pending')->count();

        return response()->json([
            'item' => $result['item'],
            'bulk_upload' => $bulkUpload,
            'done' => $pending === 0,
            'generations_remaining' => $this->remainingGenerations($user),
            'credits' => $this->creditsSummary($user),
        ]);
    }

    public function destroy(Request $request, BulkUpload $bulkUpload): JsonResponse
    {
        $this->authorizeBulkUpload($request, $bulkUpload);

        if ($bulkUpload->status === 'processing') {
            return response()->json(['message' => 'Cannot delete while processing.'], 422);
        }

        $bulkUpload->delete();

        return response()->json(['message' => 'Bulk upload deleted.']);
    }

    private function authorizeBulkUpload(Request $request, BulkUpload $bulkUpload): void
    {
        if ($bulkUpload->user_id !== $request->user()->id) {
            abort(403);
        }
    }

    private function refreshBulkStatus(BulkUpload $bulkUpload): void
    {
        $pending = $bulkUpload->items()->where('status', 'pending')->count();

        if ($pending === 0 && $bulkUpload->status !== 'completed') {
            $bulkUpload->update(['status' => 'completed']);
        }
    }
}
