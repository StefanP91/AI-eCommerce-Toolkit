<?php

namespace App\Services;

use App\Models\Product;

class SchemaGeneratorService
{
    public function generate(array $input): array
    {
        $data = $this->resolveData($input);
        $schema = $this->buildProductSchema($data);

        return [
            'schema' => $schema,
            'json_ld' => json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'product_name' => $data['name'],
        ];
    }

    private function resolveData(array $input): array
    {
        if (! empty($input['product_id'])) {
            $product = Product::findOrFail($input['product_id']);
            $c = $product->generated_content ?? [];

            return [
                'name' => $product->product_name ?? 'Product',
                'description' => $c['description'] ?? $c['short_description'] ?? '',
                'image' => $input['image_url'] ?? null,
                'url' => $product->product_url ?? $input['product_url'] ?? null,
                'sku' => $input['sku'] ?? null,
                'brand' => $input['brand'] ?? null,
                'price' => $input['price'] ?? null,
                'currency' => $input['currency'] ?? 'USD',
            ];
        }

        return [
            'name' => $input['product_name'] ?? 'Product',
            'description' => $input['description'] ?? '',
            'image' => $input['image_url'] ?? null,
            'url' => $input['product_url'] ?? null,
            'sku' => $input['sku'] ?? null,
            'brand' => $input['brand'] ?? null,
            'price' => $input['price'] ?? null,
            'currency' => $input['currency'] ?? 'USD',
        ];
    }

    private function buildProductSchema(array $data): array
    {
        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            'name' => $data['name'],
            'description' => $data['description'] ?: $data['name'],
        ];

        if (! empty($data['image'])) {
            $schema['image'] = $data['image'];
        }

        if (! empty($data['url'])) {
            $schema['url'] = $data['url'];
        }

        if (! empty($data['sku'])) {
            $schema['sku'] = $data['sku'];
        }

        if (! empty($data['brand'])) {
            $schema['brand'] = [
                '@type' => 'Brand',
                'name' => $data['brand'],
            ];
        }

        if (! empty($data['price'])) {
            $schema['offers'] = [
                '@type' => 'Offer',
                'price' => (string) $data['price'],
                'priceCurrency' => $data['currency'] ?? 'USD',
                'availability' => 'https://schema.org/InStock',
                'url' => $data['url'] ?? null,
            ];
            $schema['offers'] = array_filter($schema['offers']);
        }

        return array_filter($schema, fn ($v) => $v !== null && $v !== '');
    }
}
