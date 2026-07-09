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

    public function shopifyProductPayload(Product $product, bool $forUpdate = false): array
    {
        $fields = $this->contentFields($product);
        $content = $product->generated_content ?? [];
        $handle = $this->handle($fields['name']);

        $payload = [
            'title' => $fields['name'],
            'body_html' => $this->buildShopifyBodyHtml($fields, $content),
            'vendor' => '',
            'product_type' => $fields['category'],
            'tags' => $fields['tags'],
            'status' => 'active',
        ];

        if (! $forUpdate) {
            $urlHandle = $this->handleFromUrl($product->product_url);
            if ($urlHandle !== null) {
                $payload['handle'] = $urlHandle;
            }

            $payload['variants'] = [
                [
                    'price' => '0.00',
                    'sku' => $urlHandle ?? $handle,
                    'inventory_management' => 'shopify',
                    'inventory_quantity' => 0,
                    'inventory_policy' => 'deny',
                    'requires_shipping' => true,
                    'taxable' => true,
                ],
            ];
        }

        $metafields = [];
        if ($fields['meta_title'] !== '') {
            $metafields[] = [
                'namespace' => 'global',
                'key' => 'title_tag',
                'value' => $fields['meta_title'],
                'type' => 'single_line_text_field',
            ];
        }
        if ($fields['meta_description'] !== '') {
            $metafields[] = [
                'namespace' => 'global',
                'key' => 'description_tag',
                'value' => $fields['meta_description'],
                'type' => 'single_line_text_field',
            ];
        }
        if ($metafields !== []) {
            $payload['metafields'] = $metafields;
        }

        return $payload;
    }

    private function buildShopifyBodyHtml(array $fields, array $content): string
    {
        $parts = [];
        $description = $this->toHtml($fields['description']);
        if ($description !== '') {
            $parts[] = $description;
        }

        $features = $content['features'] ?? [];
        if ($features !== []) {
            $items = collect($features)
                ->map(fn (string $feature) => '<li>'.htmlspecialchars($feature, ENT_QUOTES, 'UTF-8').'</li>')
                ->implode('');
            $parts[] = '<h3>Features</h3><ul>'.$items.'</ul>';
        }

        $benefits = $content['benefits'] ?? [];
        if ($benefits !== []) {
            $items = collect($benefits)
                ->map(fn (string $benefit) => '<li>'.htmlspecialchars($benefit, ENT_QUOTES, 'UTF-8').'</li>')
                ->implode('');
            $parts[] = '<h3>Benefits</h3><ul>'.$items.'</ul>';
        }

        $faqs = $content['faqs'] ?? [];
        if ($faqs !== []) {
            $faqHtml = '';
            foreach ($faqs as $faq) {
                $question = htmlspecialchars((string) ($faq['question'] ?? ''), ENT_QUOTES, 'UTF-8');
                $answer = htmlspecialchars((string) ($faq['answer'] ?? ''), ENT_QUOTES, 'UTF-8');
                $faqHtml .= "<p><strong>{$question}</strong><br>{$answer}</p>";
            }
            $parts[] = '<h3>FAQs</h3>'.$faqHtml;
        }

        return implode("\n", $parts);
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

    public function handleFromUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?? '';
        if (preg_match('#/products/([^/?#]+)#', $path, $matches)) {
            return $matches[1];
        }

        return null;
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
