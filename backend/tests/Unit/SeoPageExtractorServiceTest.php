<?php

namespace Tests\Unit;

use App\Services\SeoAuditService;
use App\Services\SeoPageExtractorService;
use App\Services\StorefrontSessionService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class SeoPageExtractorServiceTest extends TestCase
{
    private function invokePrivate(object $object, string $method, mixed ...$args): mixed
    {
        $reflection = new ReflectionMethod($object, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($object, ...$args);
    }

    public function test_extracts_shopify_product_description_class(): void
    {
        $service = new SeoPageExtractorService(new StorefrontSessionService);
        $description = str_repeat('Premium snowboard for all mountain terrain. ', 5);
        $html = '<div class="product__description rte"><p>'.$description.'</p></div>';

        $result = $this->invokePrivate($service, 'extractDescription', $html);

        $this->assertGreaterThanOrEqual(150, strlen($result));
        $this->assertStringContainsString('Premium snowboard', $result);
    }

    public function test_detects_product_schema_from_json_ld(): void
    {
        $service = new SeoPageExtractorService(new StorefrontSessionService);
        $html = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Snowboard"}</script>';

        $result = $this->invokePrivate($service, 'hasProductSchema', $html);

        $this->assertTrue($result);
    }

    public function test_reads_meta_description_with_reversed_attributes(): void
    {
        $service = new SeoPageExtractorService(new StorefrontSessionService);
        $description = str_repeat('Shop this premium snowboard online with fast shipping today. ', 3);
        $html = '<meta content="'.$description.'" name="description">';

        $result = $this->invokePrivate($service, 'matchMetaName', $html, 'description');

        $this->assertSame($description, $result);
    }

    public function test_audit_scores_high_for_complete_shopify_like_page(): void
    {
        $metaDescription = 'Shop this premium all-mountain snowboard online with fast shipping, durable construction, and easy returns. Order today with confidence.';
        $description = str_repeat('Premium snowboard for all mountain terrain with durable construction. ', 5);
        $title = 'Premium All-Mountain Snowboard | MK Store';
        $h1 = 'Premium All-Mountain Snowboard Pro Edition';

        $audit = new SeoAuditService(new SeoPageExtractorService(new StorefrontSessionService));

        $report = $audit->auditManual([
            'product_url' => 'https://example.myshopify.com/products/premium-snowboard',
            'product_name' => 'Premium All-Mountain Snowboard',
            'page_title' => $title,
            'meta_description' => $metaDescription,
            'h1' => $h1,
            'description' => $description,
            'og_title' => $title,
            'og_description' => $metaDescription,
            'canonical_url' => 'https://example.myshopify.com/products/premium-snowboard',
            'has_viewport' => true,
            'has_product_schema' => true,
            'images_total' => 1,
            'images_with_alt' => 1,
            'image_alt_text' => 'Premium all-mountain snowboard product image',
        ]);

        $this->assertGreaterThanOrEqual(90, $report['score']);
    }
}
