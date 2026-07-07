<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiToolService
{
    public function __construct(
        private ProductContextService $contextService,
        private AiClientService $ai,
    ) {}

    public function generateTitles(array $input): array
    {
        $ctx = $this->contextService->build($input);
        $name = $ctx['name'];
        $suffix = $ctx['traits']['title_suffix'];

        if ($this->ai->isConfigured()) {
            $result = $this->ai->chatJson([
                ['role' => 'system', 'content' => 'Generate exactly 10 unique SEO product titles. Each title must be 30-70 characters. Never include tone or category labels like "Professional" or "General". Return JSON: {"titles":["..."]}'],
                ['role' => 'user', 'content' => "Product: {$name}\nStyle: {$input['tone']}\nCountry: {$input['target_country']}\nGenerate 10 unique SEO titles for this product."],
            ], ['temperature' => 0.8]);

            if ($result['ok'] && ! empty($result['data']['titles'])) {
                return $this->normalizeTitles($result['data']['titles'], $name, $suffix);
            }

            Log::warning('AI title generation failed, using demo', [
                'provider' => $this->ai->provider(),
                'error' => $result['error'] ?? 'unknown',
            ]);
        }

        return $this->demoTitles($name, $suffix, $ctx);
    }

    public function generateMeta(array $input): array
    {
        $ctx = $this->contextService->build($input);
        $name = $ctx['name'];
        $suffix = $ctx['traits']['title_suffix'];
        $country = $ctx['country'];

        if ($this->ai->isConfigured()) {
            $result = $this->ai->chatJson([
                ['role' => 'system', 'content' => 'Generate an SEO meta description. Must be 120-160 characters. Never include tone/category labels. Return JSON: {"meta_description":"..."}'],
                ['role' => 'user', 'content' => "Product: {$name}\nStyle: {$input['tone']}\nCountry: {$country}\nGenerate one compelling meta description."],
            ], ['temperature' => 0.7]);

            if ($result['ok'] && ! empty($result['data']['meta_description'])) {
                return [
                    'meta_description' => $this->fitMeta($result['data']['meta_description'], $name, $suffix, $country),
                ];
            }

            Log::warning('AI meta generation failed, using demo', [
                'provider' => $this->ai->provider(),
                'error' => $result['error'] ?? 'unknown',
            ]);
        }

        return [
            'meta_description' => $this->fitMeta(
                "Shop the {$name} online. {$suffix} with fast shipping to {$country}. Top quality, great reviews, and easy returns — order today!",
                $name,
                $suffix,
                $country
            ),
        ];
    }

    private function demoTitles(string $name, string $suffix, array $ctx): array
    {
        $type = $ctx['traits']['type_label'];
        $templates = [
            "{$name} | {$suffix}",
            "Buy {$name} Online | Free Shipping",
            "{$name} — Premium {$type} | Shop Now",
            "Best {$name} Deals | Order Today",
            "{$name} | Top Rated {$type}",
            "Shop {$name} | Fast Delivery Available",
            "{$name} — Quality You Can Trust",
            "Get {$name} Online | Easy Returns",
            "{$name} | Customer Favorite {$type}",
            "{$name} — Shop Now & Save Today",
        ];

        return $this->normalizeTitles($templates, $name, $suffix);
    }

    private function normalizeTitles(array $titles, string $name, string $suffix): array
    {
        $normalized = [];

        foreach ($titles as $title) {
            $title = trim(preg_replace('/\s+/', ' ', $title));
            if (strlen($title) < 30) {
                $title = "{$name} | ".Str::limit($suffix, 70 - strlen($name) - 3, '');
            }
            if (strlen($title) > 70) {
                $title = Str::limit($title, 70, '');
            }
            $normalized[] = rtrim($title, ' ,.-|');
        }

        return ['titles' => array_values(array_unique(array_slice($normalized, 0, 10)))];
    }

    private function fitMeta(string $text, string $name, string $suffix, string $country): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text));

        if (strlen($text) < 120) {
            $text = "Shop the {$name} online. {$suffix} with fast shipping to {$country}. Great quality, easy returns — order yours today!";
        }

        if (strlen($text) > 160) {
            $text = Str::limit($text, 160, '');
        }

        return rtrim($text, ' ,.-');
    }
}
