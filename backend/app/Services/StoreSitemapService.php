<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class StoreSitemapService
{
    private ?PendingRequest $http = null;

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

    public function __construct(
        private StorefrontSessionService $sessionService,
    ) {}

    public function discoverProductUrls(
        string $storeUrl,
        int $limit = 25,
        ?string $visitorPassword = null,
        ?PendingRequest $http = null,
    ): array {
        $base = $this->normalizeBaseUrl($storeUrl);
        $ownsSession = $http === null;

        try {
            $this->http = $http ?? $this->sessionService->create($base, $visitorPassword);

            $homepage = $this->fetchText($base);
            if ($this->sessionService->isPasswordProtectedHtml($homepage) && ($visitorPassword === null || $visitorPassword === '')) {
                throw new \RuntimeException(
                    'This store is password protected. Enter your visitor password and try again.'
                );
            }

            $sitemapUrls = $this->findSitemaps($base);

            if ($sitemapUrls === []) {
                throw new \RuntimeException(
                    'No sitemap found. We checked /sitemap.xml and BigCommerce /xmlsitemap.php. Make sure your storefront sitemap is publicly accessible.'
                );
            }

            $allUrls = [];
            $bigCommerceProductUrls = [];
            foreach ($sitemapUrls as $sitemapUrl) {
                $allUrls = array_merge($allUrls, $this->parseSitemap($sitemapUrl));
                $bigCommerceProductUrls = array_merge(
                    $bigCommerceProductUrls,
                    $this->extractBigCommerceProductUrls($sitemapUrl),
                );
            }

            $productUrls = $this->filterProductUrls(array_values(array_unique($allUrls)), $base);
            $bigCommerceProductUrls = $this->filterBigCommerceProductUrls(
                array_values(array_unique($bigCommerceProductUrls)),
                $base,
            );
            $productUrls = array_values(array_unique(array_merge($productUrls, $bigCommerceProductUrls)));

            if ($productUrls === []) {
                if ($this->sessionService->isPasswordProtectedHtml($this->fetchText($base))) {
                    throw new \RuntimeException(
                        'This store is password protected. Enter your visitor password and try again.'
                    );
                }

                throw new \RuntimeException('Sitemap found, but no product URLs were detected. Make sure the store has published products.');
            }

            return array_slice($productUrls, 0, $limit);
        } finally {
            if ($ownsSession) {
                $this->http = null;
            }
        }
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

    public function normalizeProductUrl(string $url): string
    {
        $url = strtolower(trim($url));
        $url = strtok($url, '?') ?: $url;
        $url = strtok($url, '#') ?: $url;

        $parts = parse_url($url);
        if ($parts === false || empty($parts['host'])) {
            return rtrim($url, '/');
        }

        $host = strtolower(preg_replace('/^www\./', '', $parts['host']));
        $path = rtrim($parts['path'] ?? '', '/');

        return $host.$path;
    }

    private function findSitemaps(string $baseUrl): array
    {
        $candidates = [
            $baseUrl.'/sitemap.xml',
            $baseUrl.'/sitemap_index.xml',
            $baseUrl.'/sitemap-index.xml',
            $baseUrl.'/wp-sitemap.xml',
            $baseUrl.'/sitemap/sitemap.xml',
            $baseUrl.'/xmlsitemap.php',
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
                $candidate = trim($sitemap);
                if ($this->urlExists($candidate)) {
                    $found[] = $candidate;
                }
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
        if (! $this->isSitemapXml($xml)) {
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

    private function extractBigCommerceProductUrls(string $url, int $depth = 0): array
    {
        if ($depth > 3) {
            return [];
        }

        $xml = $this->fetchText($url);
        if (! $this->isSitemapXml($xml)) {
            return [];
        }

        $urls = [];
        $isProductFeed = $this->isBigCommerceProductSitemapUrl($url);

        if (preg_match_all('#<loc>(.*?)</loc>#is', $xml, $matches)) {
            foreach ($matches[1] as $loc) {
                $loc = html_entity_decode(trim($loc), ENT_QUOTES | ENT_XML1, 'UTF-8');
                if ($loc === '') {
                    continue;
                }

                if ($this->looksLikeSitemapIndexEntry($loc, $xml)) {
                    $urls = array_merge($urls, $this->extractBigCommerceProductUrls($loc, $depth + 1));
                    continue;
                }

                if ($isProductFeed) {
                    $urls[] = $loc;
                }
            }
        }

        return $urls;
    }

    private function isBigCommerceProductSitemapUrl(string $url): bool
    {
        return (bool) preg_match('/[?&]type=products(?:&|$)/i', $url);
    }

    private function filterBigCommerceProductUrls(array $urls, string $baseUrl): array
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

                if (str_ends_with(strtolower($path), '.php')) {
                    return false;
                }

                foreach (self::EXCLUDED_PATH_PATTERNS as $pattern) {
                    if (preg_match($pattern, $path)) {
                        return false;
                    }
                }

                return true;
            })
            ->unique()
            ->values()
            ->all();
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
            $response = $this->client()->get($url);

            return $response->successful() && $this->isSitemapXml($response->body());
        } catch (\Exception $e) {
            return false;
        }
    }

    private function isSitemapXml(?string $content): bool
    {
        if (! $content) {
            return false;
        }

        $trimmed = ltrim($content);
        if (stripos($trimmed, '<!DOCTYPE') === 0 || stripos($trimmed, '<html') === 0) {
            return false;
        }

        return stripos($content, '<urlset') !== false
            || stripos($content, '<sitemapindex') !== false;
    }

    private function fetchText(string $url): ?string
    {
        try {
            $response = $this->client()->get($url);

            return $response->successful() ? $response->body() : null;
        } catch (\Exception $e) {
            Log::warning('Store sitemap fetch failed', ['url' => $url, 'message' => $e->getMessage()]);

            return null;
        }
    }

    private function client(): PendingRequest
    {
        return $this->http ?? throw new \LogicException('Store HTTP session has not been initialized.');
    }
}
