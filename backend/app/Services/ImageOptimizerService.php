<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ImageOptimizerService
{
    private const MAX_WIDTH = 1200;

    private const JPEG_QUALITY = 82;

    public function __construct(
        private AiClientService $ai,
    ) {}

    public function analyze(UploadedFile|string $source, string $productName, ?string $mimeType = null): array
    {
        $imageData = $this->resolveImageData($source, $mimeType);
        $seo = $this->analyzeSeo($imageData, $productName);
        $optimized = $this->compressImage($imageData['bytes'], $imageData['mime']);
        $compressionAvailable = extension_loaded('gd');

        return [
            ...$seo,
            'file_size_kb' => $imageData['size_kb'],
            'mime_type' => $imageData['mime'],
            'original_filename' => $imageData['filename'],
            'size_rating' => $this->sizeRating($imageData['size_kb']),
            'optimized_size_kb' => $optimized['size_kb'],
            'optimized_mime' => $optimized['mime'],
            'optimized_filename' => $seo['filename_suggestion'],
            'savings_percent' => $this->savingsPercent($imageData['size_kb'], $optimized['size_kb']),
            'optimized_image_base64' => base64_encode($optimized['bytes']),
            'dimensions' => $optimized['dimensions'],
            'was_resized' => $optimized['was_resized'],
            'compression_available' => $compressionAvailable,
        ];
    }

    private function analyzeSeo(array $imageData, string $productName): array
    {
        $prompt = "Analyze this product image for eCommerce SEO. Product: {$productName}. Return JSON: {\"alt_text\":\"descriptive alt 20-125 chars\",\"seo_tips\":[\"tip1\",\"tip2\",\"tip3\"],\"filename_suggestion\":\"seo-friendly-name.jpg\"}";

        if ($this->ai->isConfigured()) {
            $mime = $imageData['mime'];
            if (str_starts_with($mime, 'image/')) {
                $result = $this->ai->chatJsonWithImage(
                    $prompt,
                    'You analyze product images for eCommerce SEO. Return valid JSON only.',
                    base64_encode($imageData['bytes']),
                    $mime,
                    ['temperature' => 0.4, 'timeout' => 60],
                );

                if ($result['ok'] && is_array($result['data'])) {
                    return $this->buildSeoResult($result['data'], $imageData, $productName);
                }

                Log::warning('Image analysis failed, using demo', [
                    'provider' => $this->ai->provider(),
                    'error' => $result['error'] ?? 'unknown',
                ]);
            }
        }

        return $this->demoSeoResult($imageData, $productName);
    }

    private function compressImage(string $bytes, string $mime): array
    {
        if (! extension_loaded('gd')) {
            return [
                'bytes' => $bytes,
                'mime' => $mime,
                'size_kb' => round(strlen($bytes) / 1024, 1),
                'dimensions' => null,
                'was_resized' => false,
            ];
        }

        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            return [
                'bytes' => $bytes,
                'mime' => $mime,
                'size_kb' => round(strlen($bytes) / 1024, 1),
                'dimensions' => null,
                'was_resized' => false,
            ];
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $wasResized = false;

        if ($width > self::MAX_WIDTH) {
            $newWidth = self::MAX_WIDTH;
            $newHeight = (int) round($height * ($newWidth / $width));
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($image);
            $image = $resized;
            $width = $newWidth;
            $height = $newHeight;
            $wasResized = true;
        }

        ob_start();
        imagejpeg($image, null, self::JPEG_QUALITY);
        $optimizedBytes = ob_get_clean();
        imagedestroy($image);

        return [
            'bytes' => $optimizedBytes,
            'mime' => 'image/jpeg',
            'size_kb' => round(strlen($optimizedBytes) / 1024, 1),
            'dimensions' => "{$width}x{$height}",
            'was_resized' => $wasResized,
        ];
    }

    private function resolveImageData(UploadedFile|string $source, ?string $mimeType): array
    {
        if ($source instanceof UploadedFile) {
            $bytes = file_get_contents($source->getRealPath());
            $mime = $source->getMimeType() ?? 'image/jpeg';

            return [
                'bytes' => $bytes,
                'data_url' => 'data:'.$mime.';base64,'.base64_encode($bytes),
                'size_kb' => round($source->getSize() / 1024, 1),
                'mime' => $mime,
                'filename' => $source->getClientOriginalName(),
            ];
        }

        $response = Http::timeout(15)->get($source);
        if (! $response->successful()) {
            throw new \RuntimeException('Could not fetch image from URL.');
        }

        $bytes = $response->body();
        $mime = $mimeType ?? $response->header('Content-Type') ?? 'image/jpeg';

        return [
            'bytes' => $bytes,
            'data_url' => 'data:'.$mime.';base64,'.base64_encode($bytes),
            'size_kb' => round(strlen($bytes) / 1024, 1),
            'mime' => $mime,
            'filename' => basename(parse_url($source, PHP_URL_PATH) ?: 'image.jpg'),
        ];
    }

    private function buildSeoResult(array $parsed, array $imageData, string $productName): array
    {
        $alt = trim($parsed['alt_text'] ?? '');
        if (strlen($alt) < 20) {
            $alt = "{$productName} — high-quality product photo for online store";
        }

        $tips = array_values(array_filter($parsed['seo_tips'] ?? []));
        if (empty($tips)) {
            $tips = $this->defaultTips($imageData['size_kb']);
        }

        $filename = $parsed['filename_suggestion'] ?? $this->suggestFilename($productName);
        if (! str_ends_with(strtolower($filename), '.jpg')) {
            $filename = preg_replace('/\.[^.]+$/', '', $filename).'.jpg';
        }

        return [
            'alt_text' => $alt,
            'seo_tips' => $tips,
            'filename_suggestion' => $filename,
        ];
    }

    private function demoSeoResult(array $imageData, string $productName): array
    {
        return [
            'alt_text' => "{$productName} — premium product image showing key features and design",
            'seo_tips' => $this->defaultTips($imageData['size_kb']),
            'filename_suggestion' => $this->suggestFilename($productName),
        ];
    }

    private function defaultTips(float $sizeKb): array
    {
        $tips = [
            'Use descriptive alt text with the product name and key visual features.',
            'Rename file to a keyword-rich slug (e.g. wireless-gaming-mouse.jpg).',
        ];

        if ($sizeKb > 200) {
            $tips[] = 'Large file detected — we compressed it for faster page load.';
        } else {
            $tips[] = 'Original file size is already good for web performance.';
        }

        $tips[] = 'Add width and height attributes in HTML to prevent layout shift.';

        return $tips;
    }

    private function sizeRating(float $sizeKb): string
    {
        if ($sizeKb <= 100) {
            return 'excellent';
        }
        if ($sizeKb <= 200) {
            return 'good';
        }
        if ($sizeKb <= 500) {
            return 'fair';
        }

        return 'poor';
    }

    private function savingsPercent(float $originalKb, float $optimizedKb): int
    {
        if ($originalKb <= 0) {
            return 0;
        }

        return max(0, (int) round((($originalKb - $optimizedKb) / $originalKb) * 100));
    }

    private function suggestFilename(string $productName): string
    {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $productName));

        return trim($slug, '-').'.jpg';
    }
}
