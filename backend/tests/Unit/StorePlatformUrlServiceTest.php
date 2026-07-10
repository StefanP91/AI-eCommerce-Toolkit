<?php

namespace Tests\Unit;

use App\Services\StorePlatformUrlService;
use App\Services\StorefrontSessionService;
use PHPUnit\Framework\TestCase;

class StorePlatformUrlServiceTest extends TestCase
{
    private StorePlatformUrlService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new StorePlatformUrlService(new StorefrontSessionService);
    }

    public function test_detects_shopify_host(): void
    {
        $this->assertSame(
            'shopify',
            $this->service->detectFromUrl('https://demo-store.myshopify.com'),
        );
    }

    public function test_detects_bigcommerce_host(): void
    {
        $this->assertSame(
            'bigcommerce',
            $this->service->detectFromUrl('https://example-store.mybigcommerce.com'),
        );
    }

    public function test_rejects_shopify_url_for_bigcommerce_platform(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('BigCommerce');

        $this->service->validateForPlatform(
            'https://demo-store.myshopify.com',
            'bigcommerce',
        );
    }

    public function test_detects_shopify_in_html(): void
    {
        $html = '<html><head><script src="https://cdn.shopify.com/s/files/1/1.js"></script></head><body class="shopify-section"></body></html>';

        $this->assertSame('shopify', $this->service->detectPlatformInHtml($html));
    }

    public function test_detects_bigcommerce_in_html(): void
    {
        $html = '<html><body data-stencil><script>mybigcommerce.com</script></body></html>';

        $this->assertSame('bigcommerce', $this->service->detectPlatformInHtml($html));
    }
}
