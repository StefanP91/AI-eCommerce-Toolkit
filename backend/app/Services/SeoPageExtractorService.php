<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SeoPageExtractorService
{
    public function extract(string $url): array
    {
        $html = $this->fetchHtml($url);

        if (empty($html)) {
            throw new \RuntimeException('Could not fetch the page. Check the URL and try again.');
        }

        $pageTitle = $this->matchTag($html, 'title');
        $metaDescription = $this->matchMetaName($html, 'description');
        $h1 = $this->matchH1($html);
        $ogTitle = $this->matchMetaProperty($html, 'og:title');
        $ogDescription = $this->matchMetaProperty($html, 'og:description');
        $ogImage = $this->matchMetaProperty($html, 'og:image');
        $canonical = $this->matchCanonical($html);
        $hasViewport = (bool) preg_match('/<meta[^>]+name=["\']viewport["\']/i', $html);
        $hasProductSchema = $this->hasProductSchema($html);
        $images = $this->extractImages($html);
        $description = $this->extractDescription($html);

        $productName = $h1
            ?? $ogTitle
            ?? ($pageTitle ? trim(preg_replace('/\s*[\|–-]\s*.+$/', '', $pageTitle)) : null)
            ?? $this->nameFromUrl($url);

        return [
            'url' => $url,
            'product_name' => $this->cleanText($productName ?? ''),
            'page_title' => $this->cleanText($pageTitle ?? ''),
            'meta_description' => $this->cleanText($metaDescription ?? ''),
            'h1' => $this->cleanText($h1 ?? ''),
            'description' => $this->cleanText($description ?? ''),
            'og_title' => $this->cleanText($ogTitle ?? ''),
            'og_description' => $this->cleanText($ogDescription ?? ''),
            'og_image' => $ogImage,
            'canonical_url' => $canonical,
            'has_viewport' => $hasViewport,
            'has_product_schema' => $hasProductSchema,
            'images_total' => $images['total'],
            'images_with_alt' => $images['with_alt'],
            'sample_image_alt' => $images['sample_alt'],
        ];
    }

    private function fetchHtml(string $url): ?string
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml',
            ])->timeout(20)->get($url);

            return $response->successful() ? $response->body() : null;
        } catch (\Exception $e) {
            Log::warning('SEO audit fetch error', ['url' => $url, 'message' => $e->getMessage()]);

            return null;
        }
    }

    private function extractImages(string $html): array
    {
        $total = 0;
        $withAlt = 0;
        $sampleAlt = '';

        if (! preg_match_all('/<img\b[^>]*>/i', $html, $matches)) {
            return ['total' => 0, 'with_alt' => 0, 'sample_alt' => ''];
        }

        foreach ($matches[0] as $tag) {
            $total++;

            if (preg_match('/\balt=["\']([^"\']+)["\']/i', $tag, $m)) {
                $alt = $this->cleanText($m[1]);
                if ($alt !== '') {
                    $withAlt++;
                    if ($sampleAlt === '' && strlen($alt) >= 10) {
                        $sampleAlt = $alt;
                    }
                }
            }
        }

        return ['total' => $total, 'with_alt' => $withAlt, 'sample_alt' => $sampleAlt];
    }

    private function extractDescription(string $html): string
    {
        foreach ([
            '/<div[^>]*class=["\'][^"\']*product[_-]?description[^"\']*["\'][^>]*>(.*?)<\/div>/is',
            '/<div[^>]*class=["\'][^"\']*woocommerce-product-details__short-description[^"\']*["\'][^>]*>(.*?)<\/div>/is',
            '/<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']*)["\']/i',
        ] as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                $text = $this->cleanText(strip_tags($m[1]));
                if (strlen($text) > 30) {
                    return $text;
                }
            }
        }

        return '';
    }

    private function hasProductSchema(string $html): bool
    {
        if (! preg_match_all('/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $html, $matches)) {
            return false;
        }

        foreach ($matches[1] as $json) {
            $decoded = json_decode(trim($json), true);
            if (! is_array($decoded)) {
                continue;
            }

            if ($this->jsonLdContainsProduct($decoded)) {
                return true;
            }
        }

        return false;
    }

    private function jsonLdContainsProduct(array $node): bool
    {
        if (isset($node['@graph'])) {
            foreach ($node['@graph'] as $item) {
                if (is_array($item) && $this->jsonLdContainsProduct($item)) {
                    return true;
                }
            }
        }

        $type = $node['@type'] ?? null;
        $types = is_array($type) ? $type : [$type];

        return in_array('Product', $types, true);
    }

    private function matchH1(string $html): ?string
    {
        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $html, $m)) {
            return $this->cleanText(strip_tags($m[1]));
        }

        return null;
    }

    private function matchCanonical(string $html): ?string
    {
        if (preg_match('/<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']*)["\']/i', $html, $m)) {
            return $m[1];
        }

        if (preg_match('/<link[^>]+href=["\']([^"\']*)["\'][^>]+rel=["\']canonical["\']/i', $html, $m)) {
            return $m[1];
        }

        return null;
    }

    private function matchMetaProperty(string $html, string $property): ?string
    {
        if (preg_match('/<meta[^>]+property=["\']'.preg_quote($property, '/').'["\'][^>]+content=["\']([^"\']*)["\']/i', $html, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return null;
    }

    private function matchMetaName(string $html, string $name): ?string
    {
        if (preg_match('/<meta[^>]+name=["\']'.preg_quote($name, '/').'["\'][^>]+content=["\']([^"\']*)["\']/i', $html, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return null;
    }

    private function matchTag(string $html, string $tag): ?string
    {
        if (preg_match('/<'.$tag.'[^>]*>(.*?)<\/'.$tag.'>/is', $html, $m)) {
            return html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return null;
    }

    private function nameFromUrl(string $url): string
    {
        $slug = basename(rtrim(parse_url($url, PHP_URL_PATH) ?? '', '/'));

        return Str::title(str_replace(['-', '_'], ' ', $slug));
    }

    private function cleanText(string $text): string
    {
        return trim(preg_replace('/\s+/', ' ', html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }
}
