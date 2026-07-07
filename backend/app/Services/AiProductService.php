<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiProductService
{
    public function __construct(
        private ProductContextService $contextService,
        private ProductUrlScraperService $scraper,
        private AiClientService $ai,
    ) {}

    public function generate(array $input): array
    {
        if (($input['input_type'] ?? '') === 'url' && ! empty($input['product_url'])) {
            $scraped = $this->scraper->scrape($input['product_url']);
            $input['scraped_data'] = $scraped;
            $input['product_name'] = $scraped['product_name'] ?? $input['product_name'] ?? null;
        }

        if (! $this->ai->isConfigured()) {
            return $this->generateDemo($input);
        }

        $result = $this->ai->chatJson([
            ['role' => 'system', 'content' => $this->systemPrompt()],
            ['role' => 'user', 'content' => $this->userPrompt($input)],
        ], ['temperature' => 0.7]);

        if ($result['ok'] && is_array($result['data'])) {
            return $this->normalizeOutput($result['data']);
        }

        Log::warning('AI product generation failed, using demo', [
            'provider' => $this->ai->provider(),
            'error' => $result['error'] ?? 'unknown',
        ]);

        return $this->generateDemo($input);
    }

    private function systemPrompt(): string
    {
        return <<<'PROMPT'
You are an expert eCommerce SEO copywriter. Generate optimized product content for online stores.

IMPORTANT RULES:
- Write content unique to the specific product — never use generic filler.
- Tone is a WRITING STYLE only (e.g. luxury = elegant language). NEVER put tone names like "Professional", "Luxury", or "Friendly" in titles or descriptions.
- Category is background context only. NEVER put category names like "General", "Electronics" as labels in titles unless naturally part of the product name.
- Titles must focus on the product name and its real benefits/features, not on form field values.

Character requirements:
- seo_title: 30-70 characters
- meta_title: 30-60 characters
- meta_description: 120-160 characters
- description: 150-2000 characters
- short_description: 50-300 characters
- image_alt_text: at least 20 characters
- keywords: 8-12 items
- tags: at least 5 items
- features: at least 4 items
- benefits: at least 3 items
- faqs: at least 4 items

Respond with valid JSON using exactly these keys:
seo_title, description, short_description, meta_title, meta_description, image_alt_text, keywords, tags, features, benefits, faqs
PROMPT;
    }

    private function userPrompt(array $input): string
    {
        $ctx = $this->contextService->build($input);

        $productInfo = match ($input['input_type']) {
            'url' => ! empty($input['scraped_data'])
                ? $this->scraper->toPromptContext($input['scraped_data'])
                : "Product URL: {$input['product_url']}",
            'manual' => "Product details: {$input['manual_info']}",
            default => "Product name: {$ctx['name']}",
        };

        $lines = [
            $productInfo,
            "Writing style: {$input['tone']} (use this style in language, do NOT mention the style name in output)",
            "Target country: {$input['target_country']}",
        ];

        if ($ctx['use_category']) {
            $lines[] = "Product niche: {$input['category']} (context only, do not label content with this word)";
        }

        $lines[] = 'Generate unique, product-specific SEO content. Focus on what this exact product is and who it is for.';

        return implode("\n", $lines);
    }

    private function normalizeOutput(array $data): array
    {
        return [
            'seo_title' => $data['seo_title'] ?? '',
            'description' => $data['description'] ?? '',
            'short_description' => $data['short_description'] ?? '',
            'meta_title' => $data['meta_title'] ?? '',
            'meta_description' => $data['meta_description'] ?? '',
            'image_alt_text' => $data['image_alt_text'] ?? '',
            'keywords' => array_values($data['keywords'] ?? []),
            'tags' => array_values($data['tags'] ?? []),
            'features' => array_values($data['features'] ?? []),
            'benefits' => array_values($data['benefits'] ?? []),
            'faqs' => array_values($data['faqs'] ?? []),
        ];
    }

    private function generateDemo(array $input): array
    {
        if (! empty($input['scraped_data'])) {
            $input['product_name'] = $input['scraped_data']['product_name'] ?? $input['product_name'];
        }

        $ctx = $this->contextService->build($input);
        $name = $ctx['name'];
        $style = $ctx['style'];
        $traits = $ctx['traits'];
        $country = $ctx['country'];
        $categoryPhrase = $ctx['use_category'] ? " in the {$ctx['category']} space" : '';

        $seoTitle = "{$name} | {$traits['title_suffix']}";
        $metaTitle = "{$name} | Buy Online Today";
        $shortDesc = "The {$name} delivers {$style['feel']} performance{$categoryPhrase} — ideal for shoppers in {$country} who want quality and value.";
        $description = "Meet the {$name} — a {$style['adj']} {$traits['type_label']} built to {$style['verb']} your everyday experience. "
            .implode(' ', array_map(fn ($f) => "It features {$f}.", array_slice($traits['features'], 0, 2)))
            ." Whether you are refreshing your home, upgrading your setup, or shopping for a thoughtful gift, this {$traits['type_label']} stands out for its design and practicality. "
            ."Ships fast to {$country} with easy returns and dedicated customer support. "
            .'Order the '.strtolower($name).' today and see why customers love it.';

        $metaDescription = "Shop the {$name} online. {$traits['title_suffix']} with fast shipping to {$country}. Top quality, great reviews, and easy returns — order yours today!";

        if (! empty($input['scraped_data']['description'])) {
            $existing = $input['scraped_data']['description'];
            $description = "{$existing} Shop the {$name} with fast shipping to {$country}. "
                .'Premium quality, easy returns, and dedicated customer support. Order today with confidence.';
            $shortDesc = \Illuminate\Support\Str::limit($existing, 250);
        }

        return [
            'seo_title' => $seoTitle,
            'description' => $description,
            'short_description' => $shortDesc,
            'meta_title' => $metaTitle,
            'meta_description' => $metaDescription,
            'image_alt_text' => "{$name} — {$style['adj']} {$traits['type_label']} product photo",
            'keywords' => $this->buildKeywords($name, $traits, $country),
            'tags' => $traits['tags'],
            'features' => $traits['features'],
            'benefits' => $traits['benefits'],
            'faqs' => [
                [
                    'question' => "What makes the {$name} special?",
                    'answer' => "The {$name} combines {$style['adj']} design with practical features like ".strtolower($traits['features'][0]).' and '.strtolower($traits['features'][1]).'.',
                ],
                [
                    'question' => "Where can I use the {$name}?",
                    'answer' => "The {$name} works great in homes, offices, and everyday spaces where you need a reliable {$traits['type_label']}.",
                ],
                [
                    'question' => 'Do you ship to my country?',
                    'answer' => "Yes, we offer shipping to {$country} and many international destinations.",
                ],
                [
                    'question' => 'What if I need to return it?',
                    'answer' => 'We offer a hassle-free 30-day return policy if you are not completely satisfied.',
                ],
            ],
        ];
    }

    private function buildKeywords(string $name, array $traits, string $country): array
    {
        return array_values(array_unique(array_filter([
            strtolower($name),
            strtolower($traits['type_label']),
            strtolower($traits['tags'][0] ?? 'buy online'),
            'best '.strtolower($name),
            strtolower("{$country} shipping"),
            'shop online',
            'top rated',
            'free shipping',
            strtolower($traits['tags'][1] ?? 'quality product'),
        ])));
    }
}
