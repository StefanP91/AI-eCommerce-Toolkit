<?php

namespace App\Services;

use Illuminate\Support\Str;

class SeoContentOptimizerService
{
    public function __construct(
        private ProductContextService $contextService,
    ) {}

    public function optimize(array $content, array $context = []): array
    {
        $inputContext = $this->contextService->build([
            'product_name' => $context['product_name'] ?? null,
            'category' => $context['category'] ?? 'General',
            'target_country' => $context['target_country'] ?? 'US',
            'tone' => $context['tone'] ?? 'professional',
        ]);

        $name = $inputContext['name'];
        $country = $inputContext['country'];
        $traits = $inputContext['traits'];

        foreach (['seo_title', 'meta_title', 'meta_description', 'description', 'short_description', 'image_alt_text'] as $field) {
            if (! empty($content[$field])) {
                $content[$field] = $this->contextService->stripFieldLabels($content[$field], $inputContext);
            }
        }

        $titleSuffix = $traits['title_suffix'];
        $categorySuffix = $inputContext['use_category']
            ? ' | '.Str::limit($inputContext['category'], 20, '')
            : ' | Shop Online';

        $content['seo_title'] = $this->fitRange(
            $content['seo_title'] ?? "{$name} | {$titleSuffix}",
            30,
            70,
            " | {$titleSuffix}"
        );

        $content['meta_title'] = $this->fitRange(
            $content['meta_title'] ?? "{$name} | Buy Online Today",
            30,
            60,
            ' | Free Shipping'
        );

        $content['meta_description'] = $this->fitRange(
            $content['meta_description'] ?? "Shop the {$name} online. {$titleSuffix} with fast shipping to {$country}. Great quality, easy returns — order today!",
            120,
            160
        );

        $content['description'] = $this->fitRange(
            $content['description'] ?? $this->defaultDescription($name, $traits, $country),
            150,
            2000,
            ' Order today with fast shipping and easy returns.'
        );

        $content['short_description'] = $this->fitRange(
            $content['short_description'] ?? "The {$name} — {$titleSuffix}. Fast delivery to {$country} with easy returns.",
            50,
            300
        );

        $content['image_alt_text'] = $this->ensureMinLength(
            $content['image_alt_text'] ?? "{$name} — {$traits['type_label']} product image",
            20,
            ' with premium design and quality finish'
        );

        $content['keywords'] = $this->ensureMinCount(
            $content['keywords'] ?? [],
            5,
            fn ($i) => $this->defaultKeywords($name, $traits, $country)[$i] ?? strtolower("buy {$name}")
        );

        $content['tags'] = $this->ensureMinCount(
            $content['tags'] ?? [],
            3,
            fn ($i) => $traits['tags'][$i] ?? ['bestseller', 'new arrival', 'shop now'][$i % 3]
        );

        $content['features'] = $this->ensureMinCount(
            $content['features'] ?? [],
            3,
            fn ($i) => $traits['features'][$i] ?? 'Quality guaranteed'
        );

        $content['benefits'] = $this->ensureMinCount(
            $content['benefits'] ?? [],
            3,
            fn ($i) => $traits['benefits'][$i] ?? 'Great value for money'
        );

        $content['faqs'] = $this->ensureMinFaqs(
            $content['faqs'] ?? [],
            3,
            $name,
            $traits['type_label'],
            $country
        );

        return $content;
    }

    private function fitRange(string $text, int $min, int $max, string $suffix = ''): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text));

        if (strlen($text) > $max) {
            $text = $this->truncateAtWord($text, $max);
        }

        if (strlen($text) < $min) {
            $text = $this->extendToMin($text, $min, $max, $suffix);
        }

        if (strlen($text) > $max) {
            $text = $this->truncateAtWord($text, $max);
        }

        return trim($text);
    }

    private function truncateAtWord(string $text, int $max): string
    {
        if (strlen($text) <= $max) {
            return $text;
        }

        $truncated = Str::limit($text, $max, '');

        return rtrim($truncated, ' ,.-|');
    }

    private function extendToMin(string $text, int $min, int $max, string $suffix): string
    {
        if (empty($suffix)) {
            $suffix = ' — free shipping available.';
        }

        $extended = $text;
        $parts = array_values(array_filter(
            preg_split('/\s*\|\s*/', $suffix) ?: [$suffix],
            fn ($part) => trim($part) !== ''
        ));

        if (empty($parts)) {
            $parts = [trim($suffix)];
        }

        foreach ($parts as $part) {
            $part = trim($part);
            if (strlen($extended) >= $min) {
                break;
            }
            $separator = str_contains($extended, '|') ? ' ' : ' | ';
            $candidate = strlen($extended) > 0 ? $extended.$separator.$part : $part;
            if (strlen($candidate) <= $max) {
                $extended = $candidate;
            }
        }

        while (strlen($extended) < $min && strlen($extended) < $max) {
            $pad = ' Order online today.';
            if (strlen($extended.$pad) > $max) {
                $remaining = $max - strlen($extended);
                if ($remaining > 5) {
                    $extended .= substr($pad, 0, $remaining);
                }
                break;
            }
            $extended .= $pad;
        }

        return $extended;
    }

    private function ensureMinLength(string $text, int $min, string $padding): string
    {
        $text = trim($text);
        if (strlen($text) >= $min) {
            return $text;
        }

        return trim($text.$padding);
    }

    private function ensureMinCount(array $items, int $min, callable $fallback): array
    {
        $items = array_values(array_filter(array_unique($items)));
        $attempt = 0;

        while (count($items) < $min && $attempt < 20) {
            $candidate = $fallback($attempt);
            if (! in_array($candidate, $items, true)) {
                $items[] = $candidate;
            }
            $attempt++;
        }

        return $items;
    }

    private function ensureMinFaqs(array $faqs, int $min, string $name, string $typeLabel, string $country): array
    {
        $defaults = [
            ['question' => "What is the {$name}?", 'answer' => "The {$name} is a quality {$typeLabel} designed for everyday use and long-lasting performance."],
            ['question' => 'Do you offer shipping?', 'answer' => "Yes, we offer fast shipping to {$country} and most international destinations."],
            ['question' => 'What is the return policy?', 'answer' => 'We offer a hassle-free 30-day return policy on all products.'],
            ['question' => 'Is this product in stock?', 'answer' => 'Yes, this product is currently available and ready to ship.'],
        ];

        $valid = array_values(array_filter($faqs, fn ($f) => ! empty($f['question']) && ! empty($f['answer'])));

        foreach ($defaults as $default) {
            if (count($valid) >= $min) {
                break;
            }
            $valid[] = $default;
        }

        return $valid;
    }

    private function defaultDescription(string $name, array $traits, string $country): string
    {
        return "Discover the {$name} — {$traits['title_suffix']}. "
            ."Built as a dependable {$traits['type_label']}, it is designed for customers in {$country} who expect quality and value. "
            .implode(' ', array_map(fn ($f) => ucfirst($f).'.', array_slice($traits['features'], 0, 3)))
            .' Enjoy fast shipping, competitive pricing, and a hassle-free 30-day return policy. Order today with confidence.';
    }

    private function defaultKeywords(string $name, array $traits, string $country): array
    {
        return [
            strtolower($name),
            strtolower($traits['type_label']),
            strtolower($traits['tags'][0] ?? 'shop online'),
            'buy '.strtolower($name),
            strtolower("{$country} shipping"),
            'premium quality',
            'shop now',
            'free shipping',
        ];
    }
}
