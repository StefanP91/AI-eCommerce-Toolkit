<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class StoreSitemapService
{
    private const PRODUCT_PATH_PATTERNS = [
        '#/products?/#i',
        '#/product/#i',
        '#/shop/#i',
        '#/item/#i',
        '#/p/#i',
        '#/catalog/product/#i',
    ];

    private const EXCLUDED_PATH_PATTERNS = [
        '#/cart#i',
        '#/checkout#i',
        '#/account#i',
        '#/login#i',
        '#/register#i',
        '#/blog#i',
        '#/news#i',
        '#/category#i',
        '#/categories#i',
        '#/collection#i',
        '#/collections$#i',
        '#/tag/#i',
        '#/tags/#i',
        '#/page/#i',
        '#/pages/#i',
        '#/sitemap#i',
        '#/wp-content#i',
        '#/wp-admin#i',
        '#/feed#i',
        '#/cdn-cgi#i',
    ];

    public function discoverProductUrls(string $storeUrl, int $limit = 25): array
    {
        $base = $this->normalizeBaseUrl($storeUrl);
        $sitemapUrls = $this->findSitemaps($base);

        if ($sitemapUrls === []) {
            throw new \RuntimeException('No sitemap found. Make sure your store has /sitemap.xml enabled.');
        }

        $allUrls = [];
        foreach ($sitemapUrls as $sitemapUrl) {
            $allUrls = array_merge($allUrls, $this->parseSitemap($sitemapUrl));
        }

        $productUrls = $this->filterProductUrls(array_values(array_unique($allUrls)), $base);

        if ($productUrls === []) {
            throw new \RuntimeException('Sitemap found, but no product URLs were detected. Try a WooCommerce or Shopify store URL.');
        }

        return array_slice($productUrls, 0, $limit);
    }

    public function normalizeBaseUrl(string $url): string
    {
        $url = trim($url);
        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://'.$url;
        }

        $parts = parse_url($url);
        if ($parts === false || empty($parts['host'])) {
            throw new \InvalidArgumentException('Please enter a valid store URL.');
        }

        $scheme = strtolower($parts['scheme'] ?? 'https');
        $host = strtolower($parts['host']);
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        return $scheme.'://'.$host.$port;
    }

    private function findSitemaps(string $baseUrl): array
    {
        $candidates = [
            $baseUrl.'/sitemap.xml',
            $baseUrl.'/sitemap_index.xml',
            $baseUrl.'/sitemap-index.xml',
            $baseUrl.'/wp-sitemap.xml',
            $baseUrl.'/sitemap/sitemap.xml',
        ];

        $found = [];
        foreach ($candidates as $candidate) {
            if ($this->urlExists($candidate)) {
                $found[] = $candidate;
            }
        }

        if ($found !== []) {
            return array_values(array_unique($found));
        }

        $robots = $this->fetchText($baseUrl.'/robots.txt');
        if ($robots) {
            preg_match_all('/^Sitemap:\s*(\S+)/mi', $robots, $matches);
            foreach ($matches[1] ?? [] as $sitemap) {
                $found[] = trim($sitemap);
            }
        }

        return array_values(array_unique($found));
    }

    private function parseSitemap(string $url, int $depth = 0): array
    {
        if ($depth > 3) {
            return [];
        }

        $xml = $this->fetchText($url);
        if (! $xml) {
            return [];
        }

        $urls = [];
        if (preg_match_all('#<loc>(.*?)</loc>#is', $xml, $matches)) {
            foreach ($matches[1] as $loc) {
                $loc = html_entity_decode(trim($loc), ENT_QUOTES | ENT_XML1, 'UTF-8');
                if ($loc === '') {
                    continue;
                }

                if ($this->looksLikeSitemapIndexEntry($loc, $xml)) {
                    $urls = array_merge($urls, $this->parseSitemap($loc, $depth + 1));
                } else {
                    $urls[] = $loc;
                }
            }
        }

        return $urls;
    }

    private function looksLikeSitemapIndexEntry(string $loc, string $parentXml): bool
    {
        return str_contains($parentXml, '<sitemapindex')
            || Str::endsWith(strtolower($loc), '.xml');
    }

    private function filterProductUrls(array $urls, string $baseUrl): array
    {
        $host = parse_url($baseUrl, PHP_URL_HOST);

        return collect($urls)
            ->filter(function (string $url) use ($host) {
                $urlHost = parse_url($url, PHP_URL_HOST);
                if ($urlHost && strcasecmp($urlHost, (string) $host) !== 0) {
                    return false;
                }

                $path = parse_url($url, PHP_URL_PATH) ?? '';
                if ($path === '' || $path === '/') {
                    return false;
                }

                foreach (self::EXCLUDED_PATH_PATTERNS as $pattern) {
                    if (preg_match($pattern, $path)) {
                        return false;
                    }
                }

                foreach (self::PRODUCT_PATH_PATTERNS as $pattern) {
                    if (preg_match($pattern, $path)) {
                        return true;
                    }
                }

                return false;
            })
            ->unique()
            ->values()
            ->all();
    }

    private function urlExists(string $url): bool
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout(12)
                ->head($url);

            if ($response->successful()) {
                return true;
            }

            $response = Http::withHeaders($this->headers())
                ->timeout(12)
                ->get($url);

            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }

    private function fetchText(string $url): ?string
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout(20)
                ->get($url);

            return $response->successful() ? $response->body() : null;
        } catch (\Exception $e) {
            Log::warning('Store sitemap fetch failed', ['url' => $url, 'message' => $e->getMessage()]);

            return null;
        }
    }

    private function headers(): array
    {
        return [
            'User-Agent' => 'Mozilla/5.0 (compatible; AICommerceSuite/1.0; +https://ai-ecommerce-suite.netlify.app)',
            'Accept' => 'application/xml,text/xml,text/plain,*/*',
        ];
    }
}
