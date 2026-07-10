<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StorePlatformUrlService
{
    private const PLATFORM_LABELS = [
        'shopify' => 'Shopify',
        'woocommerce' => 'WooCommerce',
        'wix' => 'Wix eCommerce',
        'bigcommerce' => 'BigCommerce',
        'magento' => 'Magento (Adobe Commerce)',
        'squarespace' => 'Squarespace',
        'prestashop' => 'PrestaShop',
        'opencart' => 'OpenCart',
        'square' => 'Square Online',
    ];

    public function __construct(
        private StorefrontSessionService $sessionService,
    ) {}

    public function validateForPlatform(
        string $url,
        string $platform,
        ?string $visitorPassword = null,
    ): void {
        $detected = $this->detectFromUrl($url);

        if ($detected === null) {
            $detected = $this->detectFromHtml($url, $visitorPassword);
        }

        if ($detected !== null && $detected !== $platform) {
            throw new \InvalidArgumentException(sprintf(
                'This URL appears to be a %s store, but you selected %s. Choose the matching platform or paste the correct storefront URL.',
                $this->label($detected),
                $this->label($platform),
            ));
        }
    }

    public function detectFromUrl(string $url): ?string
    {
        $host = strtolower(parse_url($url, PHP_URL_HOST) ?? '');

        if ($host === '') {
            return null;
        }

        if (str_ends_with($host, '.myshopify.com') || $host === 'myshopify.com') {
            return 'shopify';
        }

        if (str_ends_with($host, '.mybigcommerce.com') || $host === 'mybigcommerce.com') {
            return 'bigcommerce';
        }

        if (str_ends_with($host, '.wixsite.com') || $host === 'wixsite.com') {
            return 'wix';
        }

        if (str_ends_with($host, '.squarespace.com') || $host === 'squarespace.com') {
            return 'squarespace';
        }

        if (str_ends_with($host, '.square.site') || $host === 'square.site') {
            return 'square';
        }

        return null;
    }

    public function detectFromHtml(string $url, ?string $visitorPassword = null): ?string
    {
        try {
            $baseUrl = rtrim($url, '/');
            $http = $visitorPassword
                ? $this->sessionService->create($baseUrl, $visitorPassword)
                : $this->defaultHttpClient();

            $response = $http->get($baseUrl);

            if (! $response->successful()) {
                return null;
            }

            return $this->detectPlatformInHtml($response->body());
        } catch (\Throwable $e) {
            Log::info('Store platform HTML detection skipped', [
                'url' => $url,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function detectPlatformInHtml(string $html): ?string
    {
        $haystack = strtolower($html);

        $signals = [
            'shopify' => ['cdn.shopify.com', 'shopify-section', 'shopify.theme', 'myshopify.com'],
            'bigcommerce' => ['mybigcommerce.com', 'bigcommerce.com/s-', 'data-stencil', 'stencil-bootstrap'],
            'woocommerce' => ['woocommerce', 'wp-content/plugins/woocommerce', 'wc-block-'],
            'wix' => ['wixstores.com', 'parastorage.com', 'static.wixstatic.com'],
            'squarespace' => ['static.squarespace.com', 'squarespace-cdn.com', 'squarespace.com/universal'],
            'magento' => ['mage/cookies', 'data-mage-init', 'magento_cache'],
            'prestashop' => ['prestashop', 'modules/ps_'],
            'opencart' => ['index.php?route=product/', 'catalog/view/theme'],
            'square' => ['square.site', 'squareup.com', 'square-online-store'],
        ];

        $scores = [];

        foreach ($signals as $platform => $needles) {
            $scores[$platform] = 0;

            foreach ($needles as $needle) {
                if (str_contains($haystack, strtolower($needle))) {
                    $scores[$platform]++;
                }
            }
        }

        arsort($scores);
        $topPlatform = array_key_first($scores);
        $topScore = $scores[$topPlatform] ?? 0;

        if ($topScore === 0) {
            return null;
        }

        $secondScore = 0;
        $index = 0;
        foreach ($scores as $score) {
            if ($index === 1) {
                $secondScore = $score;
                break;
            }
            $index++;
        }

        if ($topScore === $secondScore) {
            return null;
        }

        return $topPlatform;
    }

    private function defaultHttpClient(): PendingRequest
    {
        return Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (compatible; AICommerceSuite/1.0; +https://ai-ecommerce-suite.netlify.app)',
            'Accept' => 'text/html,application/xhtml+xml',
        ])->timeout(15);
    }

    private function label(string $platform): string
    {
        return self::PLATFORM_LABELS[$platform] ?? ucfirst($platform);
    }
}
