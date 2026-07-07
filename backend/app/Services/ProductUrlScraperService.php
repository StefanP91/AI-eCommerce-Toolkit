<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProductUrlScraperService
{
    public function scrape(string $url): array
    {
        $html = $this->fetchHtml($url);

        if (empty($html)) {
            throw new \RuntimeException('Could not fetch product page. Check the URL and try again.');
        }

        $data = array_merge(
            $this->extractFromJsonLd($html),
            $this->extractFromOpenGraph($html),
            $this->extractFromMetaTags($html),
            $this->extractFromHtml($html),
        );

        $data['source_url'] = $url;
        $data['product_name'] = $this->resolveProductName($data, $url);
        $data['description'] = $this->cleanText($data['description'] ?? '');

        if (empty($data['product_name']) && empty($data['description'])) {
            throw new \RuntimeException('Could not extract product information from this URL.');
        }

        return $data;
    }

    public function toPromptContext(array $scraped): string
    {
        $lines = ['Extracted product data from URL:'];

        foreach ([
            'product_name' => 'Product Name',
            'brand' => 'Brand',
            'price' => 'Price',
            'category' => 'Category',
            'description' => 'Existing Description',
            'sku' => 'SKU',
        ] as $key => $label) {
            if (! empty($scraped[$key])) {
                $lines[] = "{$label}: {$scraped[$key]}";
            }
        }

        if (! empty($scraped['features'])) {
            $lines[] = 'Features: '.implode('; ', $scraped['features']);
        }

        $lines[] = "Source URL: {$scraped['source_url']}";

        return implode("\n", $lines);
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
            Log::warning('Product URL fetch error', ['url' => $url, 'message' => $e->getMessage()]);

            return null;
        }
    }

    private function extractFromJsonLd(string $html): array
    {
        $data = [];

        if (! preg_match_all('/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $html, $matches)) {
            return $data;
        }

        foreach ($matches[1] as $json) {
            $decoded = json_decode(trim($json), true);
            if (! is_array($decoded)) {
                continue;
            }

            foreach ($this->findProductsInJsonLd($decoded) as $product) {
                if (! empty($product['name'])) {
                    $data['product_name'] = $this->cleanText($product['name']);
                }
                if (! empty($product['description'])) {
                    $data['description'] = $this->cleanText($product['description']);
                }
                if (! empty($product['brand'])) {
                    $brand = $product['brand'];
                    $data['brand'] = $this->cleanText(is_array($brand) ? ($brand['name'] ?? '') : $brand);
                }
                if (! empty($product['offers']['price'] ?? null)) {
                    $data['price'] = $product['offers']['price'];
                }
            }
        }

        return $data;
    }

    private function findProductsInJsonLd(array $node): array
    {
        $products = [];

        if (isset($node['@graph'])) {
            foreach ($node['@graph'] as $item) {
                $products = array_merge($products, $this->findProductsInJsonLd($item));
            }
        }

        $type = $node['@type'] ?? null;
        $types = is_array($type) ? $type : [$type];
        if (in_array('Product', $types, true)) {
            $products[] = $node;
        }

        return $products;
    }

    private function extractFromOpenGraph(string $html): array
    {
        $data = [];

        if ($title = $this->matchMeta($html, 'og:title')) {
            $data['product_name'] = $this->cleanText($title);
        }
        if ($desc = $this->matchMeta($html, 'og:description')) {
            $data['description'] = $this->cleanText($desc);
        }

        return $data;
    }

    private function extractFromMetaTags(string $html): array
    {
        $data = [];

        if ($title = $this->matchTag($html, 'title')) {
            $data['page_title'] = $this->cleanText($title);
        }
        if ($desc = $this->matchMetaName($html, 'description')) {
            $data['meta_description'] = $this->cleanText($desc);
        }

        return $data;
    }

    private function extractFromHtml(string $html): array
    {
        $data = [];

        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $html, $m)) {
            $data['product_name'] = $this->cleanText(strip_tags($m[1]));
        }

        foreach ([
            '/<div[^>]*class=["\'][^"\']*product[_-]?description[^"\']*["\'][^>]*>(.*?)<\/div>/is',
            '/<div[^>]*class=["\'][^"\']*woocommerce-product-details__short-description[^"\']*["\'][^>]*>(.*?)<\/div>/is',
        ] as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                $desc = $this->cleanText(strip_tags($m[1]));
                if (strlen($desc) > 30) {
                    $data['description'] = $desc;
                    break;
                }
            }
        }

        return $data;
    }

    private function matchMeta(string $html, string $property): ?string
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

    private function resolveProductName(array $data, string $url): string
    {
        if (! empty($data['product_name'])) {
            return $data['product_name'];
        }

        if (! empty($data['page_title'])) {
            return trim(preg_replace('/\s*[\|–-]\s*.+$/', '', $data['page_title']));
        }

        $slug = basename(rtrim(parse_url($url, PHP_URL_PATH) ?? '', '/'));

        return Str::title(str_replace(['-', '_'], ' ', $slug));
    }

    private function cleanText(string $text): string
    {
        return trim(preg_replace('/\s+/', ' ', html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }
}
