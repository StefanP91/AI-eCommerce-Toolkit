<?php

namespace App\Services;

use App\Models\BulkUpload;
use App\Models\BulkUploadItem;
use App\Models\GenerationHistory;
use App\Models\Product;
use App\Models\User;

class BulkUploadService
{
    public function __construct(
        private AiProductService $aiService,
        private SeoContentOptimizerService $optimizer,
        private SeoScoreService $seoService,
    ) {}

    public function applyDefaults(array $row, array $defaults): array
    {
        return [
            ...$row,
            'language' => $row['language'] ?? $defaults['language'] ?? 'en',
            'tone' => $row['tone'] ?? $defaults['tone'] ?? 'professional',
            'target_country' => $row['target_country'] ?? $defaults['target_country'] ?? 'US',
            'category' => $row['category'] ?? $defaults['category'] ?? 'General',
        ];
    }

    public function processNextItem(BulkUpload $bulkUpload, User $user): ?array
    {
        $item = $bulkUpload->items()
            ->where('status', 'pending')
            ->orderBy('row_number')
            ->first();

        if (! $item) {
            $this->refreshBulkStatus($bulkUpload);

            return null;
        }

        $bulkUpload->update(['status' => 'processing']);
        $item->update(['status' => 'processing']);

        try {
            $input = $item->toInputArray();
            $content = $this->aiService->generate($input);

            if (empty($input['product_name'])) {
                $input['product_name'] = $item->product_name
                    ?? $this->nameFromUrl($input['product_url'] ?? null)
                    ?? strtok($content['seo_title'] ?? '', ' |');
            }

            $content = $this->optimizer->optimize($content, [
                'product_name' => $input['product_name'],
                'category' => $input['category'] ?? 'General',
                'target_country' => $input['target_country'],
                'tone' => $input['tone'],
            ]);

            $seo = $this->seoService->calculate($content);

            $product = Product::create([
                'user_id' => $user->id,
                'input_type' => $input['input_type'],
                'product_name' => $input['product_name'],
                'product_url' => $input['product_url'] ?? null,
                'manual_info' => $input['manual_info'] ?? null,
                'language' => $input['language'],
                'tone' => $input['tone'],
                'target_country' => $input['target_country'],
                'category' => $input['category'] ?? null,
                'generated_content' => $content,
                'seo_score' => $seo['score'],
                'seo_checks' => $seo['checks'],
            ]);

            $inputSummary = $input['product_name']
                ?? $input['product_url']
                ?? substr($input['manual_info'] ?? '', 0, 100);

            GenerationHistory::create([
                'user_id' => $user->id,
                'product_id' => $product->id,
                'type' => 'bulk_upload',
                'input_summary' => $inputSummary,
                'seo_score' => $seo['score'],
                'result_data' => [
                    'bulk_upload_id' => $bulkUpload->id,
                    'bulk_upload_item_id' => $item->id,
                    'product_id' => $product->id,
                ],
            ]);

            $item->update([
                'status' => 'completed',
                'product_id' => $product->id,
                'product_name' => $input['product_name'],
                'error_message' => null,
            ]);

            $bulkUpload->increment('successful_rows');
        } catch (\Throwable $e) {
            $item->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            $bulkUpload->increment('failed_rows');
        }

        $bulkUpload->increment('processed_rows');
        $this->refreshBulkStatus($bulkUpload->fresh());

        return [
            'item' => $item->fresh(['product:id,product_name,seo_score']),
            'bulk_upload' => $bulkUpload->fresh(),
        ];
    }

    private function refreshBulkStatus(BulkUpload $bulkUpload): void
    {
        $pending = $bulkUpload->items()->where('status', 'pending')->count();

        $bulkUpload->update([
            'status' => $pending === 0 ? 'completed' : $bulkUpload->status,
        ]);
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
