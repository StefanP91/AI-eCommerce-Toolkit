<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Services\PlatformExportService;
use App\Services\ProductContextService;
use App\Services\SeoContentOptimizerService;
use PHPUnit\Framework\TestCase;

class PlatformExportServiceTest extends TestCase
{
    public function test_shopify_payload_uses_optimized_seo_fields(): void
    {
        $optimizer = new SeoContentOptimizerService(new ProductContextService);
        $service = new PlatformExportService($optimizer);

        $product = new Product([
            'product_name' => 'Snowboard',
            'category' => 'Sports',
            'generated_content' => [
                'seo_title' => 'Snowboard',
                'meta_title' => 'Snowboard',
                'meta_description' => 'Short',
                'description' => 'Too short',
                'tags' => ['snowboard'],
                'image_alt_text' => 'Snowboard',
            ],
        ]);

        $payload = $service->shopifyProductPayload($product);

        $this->assertGreaterThanOrEqual(20, strlen($payload['title']));
        $this->assertLessThanOrEqual(70, strlen($payload['title']));
        $this->assertStringContainsString('product__description', $payload['body_html']);
        $this->assertGreaterThanOrEqual(150, strlen(strip_tags($payload['body_html'])));
    }
}
