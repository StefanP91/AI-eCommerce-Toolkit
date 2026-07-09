<?php

namespace App\Services;

class SeoAuditService
{
    public function __construct(
        private SeoPageExtractorService $extractor,
    ) {}

    public function auditUrl(string $url, ?\Illuminate\Http\Client\PendingRequest $http = null): array
    {
        $page = $this->extractor->extract($url, $http);

        return $this->buildReport($page, urlMode: true);
    }

    public function auditManual(array $input): array
    {
        $page = [
            'url' => $input['product_url'] ?? null,
            'product_name' => $input['product_name'] ?? '',
            'page_title' => $input['page_title'] ?? '',
            'meta_description' => $input['meta_description'] ?? '',
            'h1' => $input['h1'] ?? $input['product_name'] ?? '',
            'description' => $input['description'] ?? '',
            'og_title' => $input['og_title'] ?? '',
            'og_description' => $input['og_description'] ?? '',
            'og_image' => $input['og_image'] ?? null,
            'canonical_url' => $input['canonical_url'] ?? null,
            'has_viewport' => (bool) ($input['has_viewport'] ?? false),
            'has_product_schema' => (bool) ($input['has_product_schema'] ?? false),
            'images_total' => (int) ($input['images_total'] ?? 0),
            'images_with_alt' => (int) ($input['images_with_alt'] ?? (! empty($input['image_alt_text'] ?? null) ? 1 : 0)),
            'sample_image_alt' => $input['image_alt_text'] ?? '',
        ];

        return $this->buildReport($page, urlMode: false);
    }

    private function buildReport(array $page, bool $urlMode): array
    {
        $checks = [
            'page_title' => $this->checkPageTitle($page['page_title'] ?? ''),
            'meta_description' => $this->checkMetaDescription($page['meta_description'] ?? ''),
            'h1' => $this->checkH1($page['h1'] ?? ''),
            'description' => $this->checkDescription($page['description'] ?? ''),
            'image_alt' => $this->checkImageAlt($page),
            'product_in_title' => $this->checkProductInTitle($page),
        ];

        if ($urlMode) {
            $checks['open_graph'] = $this->checkOpenGraph($page);
            $checks['product_schema'] = $this->checkProductSchema($page);
            $checks['canonical'] = $this->checkCanonical($page);
            $checks['viewport'] = $this->checkViewport($page);
            $checks['url_slug'] = $this->checkUrlSlug($page['url'] ?? '');
        }

        $passed = count(array_filter($checks, fn ($c) => $c['passed']));
        $total = count($checks);
        $score = (int) round(($passed / max($total, 1)) * 100);

        $recommendations = collect($checks)
            ->filter(fn ($c) => ! $c['passed'])
            ->pluck('recommendation')
            ->filter()
            ->values()
            ->all();

        return [
            'score' => $score,
            'checks' => $checks,
            'recommendations' => $recommendations,
            'extracted' => $page,
            'audit_mode' => $urlMode ? 'url' : 'manual',
        ];
    }

    private function checkPageTitle(string $title): array
    {
        $len = strlen($title);
        $passed = $len >= 30 && $len <= 60;

        return [
            'label' => 'Page Title',
            'passed' => $passed,
            'message' => $passed
                ? "Good title length ({$len} chars)"
                : ($len === 0 ? 'Missing page title tag' : "Title is {$len} chars — aim for 30-60"),
            'recommendation' => $passed ? null : 'Write a unique page title between 30-60 characters with the main product keyword.',
        ];
    }

    private function checkMetaDescription(string $desc): array
    {
        $len = strlen($desc);
        $passed = $len >= 120 && $len <= 160;

        return [
            'label' => 'Meta Description',
            'passed' => $passed,
            'message' => $passed
                ? "Good meta description ({$len} chars)"
                : ($len === 0 ? 'Missing meta description' : "Meta description is {$len} chars — aim for 120-160"),
            'recommendation' => $passed ? null : 'Add a compelling meta description (120-160 chars) with a clear call to action.',
        ];
    }

    private function checkH1(string $h1): array
    {
        $len = strlen($h1);
        $passed = $len >= 20 && $len <= 70;

        return [
            'label' => 'H1 Heading',
            'passed' => $passed,
            'message' => $passed
                ? 'H1 heading is present and well-sized'
                : ($len === 0 ? 'Missing H1 heading' : "H1 is {$len} chars — aim for 20-70"),
            'recommendation' => $passed ? null : 'Use one clear H1 with the product name and primary keyword.',
        ];
    }

    private function checkDescription(string $desc): array
    {
        $len = strlen($desc);
        $passed = $len >= 150;

        return [
            'label' => 'Product Description',
            'passed' => $passed,
            'message' => $passed
                ? "Good description length ({$len} chars)"
                : ($len === 0 ? 'No product description found' : "Description is only {$len} chars — aim for 150+"),
            'recommendation' => $passed ? null : 'Expand the product description with features, benefits, and use cases (150+ chars).',
        ];
    }

    private function checkImageAlt(array $page): array
    {
        $alt = $page['sample_image_alt'] ?? '';
        $withAlt = (int) ($page['images_with_alt'] ?? 0);
        $total = (int) ($page['images_total'] ?? 0);
        $passed = strlen($alt) >= 20 || ($total > 0 && $withAlt > 0 && strlen($alt) >= 10);

        if ($total === 0 && $alt !== '') {
            $passed = strlen($alt) >= 20;
        }

        return [
            'label' => 'Image Alt Text',
            'passed' => $passed,
            'message' => $passed
                ? 'Product images have descriptive alt text'
                : ($total === 0 ? 'No images found or alt text missing' : "{$withAlt}/{$total} images have alt text"),
            'recommendation' => $passed ? null : 'Add descriptive alt text (20+ chars) to all product images for accessibility and SEO.',
        ];
    }

    private function checkProductInTitle(array $page): array
    {
        $name = strtolower($page['product_name'] ?? '');
        $title = strtolower($page['page_title'] ?? '');
        $passed = $name !== '' && $title !== '' && str_contains($title, $name);

        if (! $passed && $name !== '' && strlen($name) > 4) {
            $words = array_filter(explode(' ', $name), fn ($w) => strlen($w) > 3);
            $passed = count(array_filter($words, fn ($w) => str_contains($title, strtolower($w)))) >= 1;
        }

        return [
            'label' => 'Keyword in Title',
            'passed' => $passed,
            'message' => $passed
                ? 'Product name appears in the page title'
                : 'Product name is not clearly reflected in the page title',
            'recommendation' => $passed ? null : 'Include the main product keyword in the page title for better rankings.',
        ];
    }

    private function checkOpenGraph(array $page): array
    {
        $passed = ! empty($page['og_title']) && ! empty($page['og_description']);

        return [
            'label' => 'Open Graph Tags',
            'passed' => $passed,
            'message' => $passed
                ? 'Open Graph title and description are set'
                : 'Missing og:title or og:description',
            'recommendation' => $passed ? null : 'Add Open Graph tags so product pages look good when shared on social media.',
        ];
    }

    private function checkProductSchema(array $page): array
    {
        $passed = (bool) ($page['has_product_schema'] ?? false);

        return [
            'label' => 'Product Schema (JSON-LD)',
            'passed' => $passed,
            'message' => $passed
                ? 'Product structured data detected'
                : 'No Product JSON-LD schema found',
            'recommendation' => $passed ? null : 'Add Product schema markup to unlock rich results in Google.',
        ];
    }

    private function checkCanonical(array $page): array
    {
        $passed = ! empty($page['canonical_url']);

        return [
            'label' => 'Canonical URL',
            'passed' => $passed,
            'message' => $passed
                ? 'Canonical link tag is present'
                : 'Missing canonical URL',
            'recommendation' => $passed ? null : 'Add a canonical link tag to prevent duplicate content issues.',
        ];
    }

    private function checkViewport(array $page): array
    {
        $passed = (bool) ($page['has_viewport'] ?? false);

        return [
            'label' => 'Mobile Viewport',
            'passed' => $passed,
            'message' => $passed
                ? 'Viewport meta tag found'
                : 'Missing viewport meta tag',
            'recommendation' => $passed ? null : 'Add a viewport meta tag for proper mobile rendering.',
        ];
    }

    private function checkUrlSlug(string $url): array
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        $slug = basename(rtrim($path, '/'));
        $passed = $slug !== '' && strlen($slug) >= 3 && ! preg_match('/^\d+$/', $slug);

        return [
            'label' => 'URL Structure',
            'passed' => $passed,
            'message' => $passed
                ? 'URL uses a readable slug'
                : 'URL slug is not SEO-friendly',
            'recommendation' => $passed ? null : 'Use descriptive, keyword-rich URL slugs instead of IDs or random strings.',
        ];
    }
}
