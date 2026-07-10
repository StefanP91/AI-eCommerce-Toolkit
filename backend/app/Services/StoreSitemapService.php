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
        '#/product-page/#i',
        '#/shop/p/#i',
        '#/shop/#i',
        '#/store/#i',
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

    private const PRODUCT_SITEMAP_URL_PATTERNS = [
        '/[?&]type=products(?:&|$)/i',
        '/product-sitemap(?:\d+)?\.xml/i',
        '/products-sitemap(?:\d+)?\.xml/i',
        '/sitemap_products(?:_[a-z]{2})?(?:_\d+)?\.xml/i',
        '/wp-sitemap-posts-product(?:-\d+)?\.xml/i',
        '/store-products-sitemap\.xml/i',
        '/posttype-product/i',
        '/catalog_product/i',
        '/_\d+_[a-z]{2}_1_sitemap\.xml/i',
        '/\d+_[a-z]{2}_1_sitemap\.xml/i',
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
                    'No sitemap found. We checked common storefront sitemap paths (including Shopify /sitemap.xml, WooCommerce /wp-sitemap.xml, BigCommerce /xmlsitemap.php, and Wix /store-products-sitemap.xml). Make sure your sitemap is publicly accessible.'
                );
            }

            $allUrls = [];
            $feedProductUrls = [];
            foreach ($sitemapUrls as $sitemapUrl) {
                $allUrls = array_merge($allUrls, $this->parseSitemap($sitemapUrl));
                $feedProductUrls = array_merge(
                    $feedProductUrls,
                    $this->extractProductFeedUrls($sitemapUrl),
                );
            }

            $productUrls = $this->filterProductUrls(array_values(array_unique($allUrls)), $base);
            $feedProductUrls = $this->filterFeedProductUrls(
                array_values(array_unique($feedProductUrls)),
                $base,
            );
            $productUrls = array_values(array_unique(array_merge($productUrls, $feedProductUrls)));

            if ($productUrls === []) {
                if ($this->sessionService->isPasswordProtectedHtml($this->fetchText($base))) {
                    throw new \RuntimeException(
                        'This store is password protected. Enter your visitor password and try again.'
                    );
                }

                throw new \RuntimeException('Sitemap found, but no product URLs were detected. Make sure the store has published products.');
            }

            if ($limit !== null && $limit > 0) {
                return array_slice($productUrls, 0, $limit);
            }

            return $productUrls;
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
            $baseUrl.'/store-products-sitemap.xml',
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

    private function extractProductFeedUrls(string $url, int $depth = 0): array
    {
        if ($depth > 3) {
            return [];
        }

        $xml = $this->fetchText($url);
        if (! $this->isSitemapXml($xml)) {
            return [];
        }

        $urls = [];
        $isProductFeed = $this->isProductSitemapUrl($url);

        if (preg_match_all('#<loc>(.*?)</loc>#is', $xml, $matches)) {
            foreach ($matches[1] as $loc) {
                $loc = html_entity_decode(trim($loc), ENT_QUOTES | ENT_XML1, 'UTF-8');
                if ($loc === '') {
                    continue;
                }

                if ($this->looksLikeSitemapIndexEntry($loc, $xml)) {
                    $urls = array_merge($urls, $this->extractProductFeedUrls($loc, $depth + 1));
                    continue;
                }

                if ($isProductFeed) {
                    $urls[] = $loc;
                }
            }
        }

        return $urls;
    }

    private function isProductSitemapUrl(string $url): bool
    {
        foreach (self::PRODUCT_SITEMAP_URL_PATTERNS as $pattern) {
            if (preg_match($pattern, $url)) {
                return true;
            }
        }

        return false;
    }

    private function filterFeedProductUrls(array $urls, string $baseUrl): array
    {
        return collect($urls)
            ->filter(fn (string $url) => $this->isLikelyFeedProductUrl($url, $baseUrl))
            ->unique()
            ->values()
            ->all();
    }

    private function filterProductUrls(array $urls, string $baseUrl): array
    {
        return collect($urls)
            ->filter(fn (string $url) => $this->isLikelyPatternProductUrl($url, $baseUrl))
            ->unique()
            ->values()
            ->all();
    }

    private function isLikelyFeedProductUrl(string $url, string $baseUrl): bool
    {
        if (! $this->isSameStoreHost($url, $baseUrl)) {
            return false;
        }

        if ($this->isOpenCartProductUrl($url)) {
            return true;
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
    }

    private function isLikelyPatternProductUrl(string $url, string $baseUrl): bool
    {
        if (! $this->isSameStoreHost($url, $baseUrl)) {
            return false;
        }

        if ($this->isOpenCartProductUrl($url)) {
            return true;
        }

        $path = parse_url($url, PHP_URL_PATH) ?? '';
        if ($path === '' || $path === '/') {
            return false;
        }

        if (str_ends_with(strtolower($path), '.php') && ! $this->isOpenCartProductUrl($url)) {
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
    }

    private function isSameStoreHost(string $url, string $baseUrl): bool
    {
        $urlHost = parse_url($url, PHP_URL_HOST);
        $baseHost = parse_url($baseUrl, PHP_URL_HOST);

        if (! $urlHost || ! $baseHost) {
            return true;
        }

        return $this->hostsMatch($urlHost, $baseHost);
    }

    private function isOpenCartProductUrl(string $url): bool
    {
        $query = parse_url($url, PHP_URL_QUERY);
        if (! is_string($query) || $query === '') {
            return false;
        }

        parse_str($query, $params);
        $route = strtolower((string) ($params['route'] ?? ''));

        return $route === 'product/product' || $route === 'product/product/review';
    }

    private function hostsMatch(string $leftHost, string $rightHost): bool
    {
        $normalize = static fn (string $host): string => strtolower(preg_replace('/^www\./', '', $host) ?? $host);

        return $normalize($leftHost) === $normalize($rightHost);
    }

    private function looksLikeSitemapIndexEntry(string $loc, string $parentXml): bool
    {
        if (str_contains($parentXml, '<sitemapindex')) {
            return true;
        }

        $path = parse_url($loc, PHP_URL_PATH) ?? '';

        return Str::endsWith(strtolower($path), '.xml')
            || Str::contains(strtolower($loc), 'xmlsitemap.php');
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
