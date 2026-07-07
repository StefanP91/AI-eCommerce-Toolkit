<?php

namespace Tests\Unit;

use App\Services\SchemaGeneratorService;
use PHPUnit\Framework\TestCase;

class SchemaGeneratorServiceTest extends TestCase
{
    public function test_generates_product_schema(): void
    {
        $service = new SchemaGeneratorService;

        $result = $service->generate([
            'product_name' => 'Wireless Mouse',
            'description' => 'A great wireless mouse for gaming.',
            'price' => '29.99',
            'currency' => 'USD',
            'brand' => 'TechBrand',
        ]);

        $this->assertSame('Wireless Mouse', $result['product_name']);
        $this->assertSame('Product', $result['schema']['@type']);
        $this->assertStringContainsString('Wireless Mouse', $result['json_ld']);
        $this->assertSame('29.99', $result['schema']['offers']['price']);
    }
}
