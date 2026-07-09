<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Str;

class PlatformExportService
{
    public function toShopifyCsv(Product $product): string
    {
        return $this->buildCsv([$this->shopifyHeaders(), $this->shopifyRow($product)]);
    }

    public function toWooCommerceCsv(Product $product): string
    {
        return $this->buildCsv([$this->wooCommerceHeaders(), $this->wooCommerceRow($product)]);
    }

    public function toBigCommerceCsv(Product $product): string
    {
        return $this->buildCsv([$this->bigCommerceHeaders(), $this->bigCommerceRow($product)]);
    }

    public function bulkShopifyCsv(iterable $products): string
    {
        $rows = [$this->shopifyHeaders()];
        foreach ($products as $product) {
            $rows[] = $this->shopifyRow($product);
        }

        return $this->buildCsv($rows);
    }

    public function bulkWooCommerceCsv(iterable $products): string
    {
        $rows = [$this->wooCommerceHeaders()];
        foreach ($products as $product) {
            $rows[] = $this->wooCommerceRow($product);
        }

        return $this->buildCsv($rows);
    }

    public function bulkBigCommerceCsv(iterable $products): string
    {
        $rows = [$this->bigCommerceHeaders()];
        foreach ($products as $product) {
            $rows[] = $this->bigCommerceRow($product);
        }

        return $this->buildCsv($rows);
    }

    private function shopifyHeaders(): array
    {
        return [
            'Handle',
            'Title',
            'Body (HTML)',
            'Vendor',
            'Type',
            'Tags',
            'Published',
            'Option1 Name',
            'Option1 Value',
            'Variant SKU',
            'Variant Inventory Tracker',
            'Variant Inventory Qty',
            'Variant Inventory Policy',
            'Variant Fulfillment Service',
            'Variant Price',
            'Variant Requires Shipping',
            'Variant Taxable',
            'Image Alt Text',
            'SEO Title',
            'SEO Description',
            'Status',
        ];
    }

    private function shopifyRow(Product $product): array
    {
        $fields = $this->contentFields($product);
        $handle = $this->handle($fields['name']);

        return [
            $handle,
            $fields['name'],
            $this->toHtml($fields['description']),
            '',
            $fields['category'],
            $fields['tags'],
            'TRUE',
            'Title',
            'Default Title',
            $handle,
            'shopify',
            '0',
            'deny',
            'manual',
            '0.00',
            'TRUE',
            'TRUE',
            $fields['image_alt'],
            $fields['meta_title'],
            $fields['meta_description'],
            'active',
        ];
    }

    private function wooCommerceHeaders(): array
    {
        return [
            'Type',
            'SKU',
            'Name',
            'Published',
            'Is featured?',
            'Visibility in catalog',
            'Short description',
            'Description',
            'Categories',
            'Tags',
        ];
    }

    private function wooCommerceRow(Product $product): array
    {
        $fields = $this->contentFields($product);

        return [
            'simple',
            $this->handle($fields['name']),
            $fields['name'],
            '1',
            '0',
            'visible',
            $fields['short_description'],
            $fields['description'],
            $fields['category'],
            $fields['tags'],
        ];
    }

    private function bigCommerceHeaders(): array
    {
        return [
            'Item Type',
            'Product Name',
            'Product Type',
            'SKU',
            'Description',
            'Page Title',
            'Meta Description',
            'Product Tags',
            'Category',
        ];
    }

    private function bigCommerceRow(Product $product): array
    {
        $fields = $this->contentFields($product);

        return [
            'Product',
            $fields['name'],
            'P',
            $this->handle($fields['name']),
            $fields['description'],
            $fields['meta_title'],
            $fields['meta_description'],
            $fields['tags'],
            $fields['category'],
        ];
    }

    private function contentFields(Product $product): array
    {
        $content = $product->generated_content ?? [];

        return [
            'name' => $product->product_name ?? '',
            'description' => $content['description'] ?? '',
            'short_description' => $content['short_description'] ?? '',
            'meta_title' => $content['meta_title'] ?? $content['seo_title'] ?? '',
            'meta_description' => $content['meta_description'] ?? '',
            'tags' => implode(', ', $content['tags'] ?? []),
            'image_alt' => $content['image_alt_text'] ?? '',
            'category' => $product->category ?? '',
        ];
    }

    private function handle(string $name): string
    {
        $handle = Str::slug($name);

        return $handle !== '' ? $handle : 'product';
    }

    private function toHtml(string $text): string
    {
        if ($text === '') {
            return '';
        }

        if (preg_match('/<[^>]+>/', $text)) {
            return $text;
        }

        $paragraphs = preg_split("/\R\R+/", trim($text)) ?: [$text];

        return collect($paragraphs)
            ->map(fn (string $paragraph) => '<p>'.htmlspecialchars(trim($paragraph), ENT_QUOTES, 'UTF-8').'</p>')
            ->implode('');
    }

    private function buildCsv(array $rows): string
    {
        $output = fopen('php://temp', 'r+');
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

        foreach ($rows as $row) {
            fputcsv($output, $row);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }
}
