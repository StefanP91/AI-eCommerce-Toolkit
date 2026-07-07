<?php

namespace App\Services;

use App\Models\Product;

class ProductExportService
{
    public function toCsv(Product $product): string
    {
        $content = $product->generated_content ?? [];
        $rows = [$this->headers()];

        $rows[] = $this->productRow($product, $content);

        return $this->buildCsv($rows);
    }

    public function toExcelXml(Product $product): string
    {
        $content = $product->generated_content ?? [];
        $row = $this->productRow($product, $content);
        $headers = $this->headers();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>'."\n";
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
        $xml .= 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'."\n";
        $xml .= '<Worksheet ss:Name="Product"><Table>'."\n";

        $xml .= '<Row>';
        foreach ($headers as $header) {
            $xml .= '<Cell><Data ss:Type="String">'.$this->escapeXml($header).'</Data></Cell>';
        }
        $xml .= '</Row>';

        $xml .= '<Row>';
        foreach ($row as $cell) {
            $xml .= '<Cell><Data ss:Type="String">'.$this->escapeXml($cell).'</Data></Cell>';
        }
        $xml .= '</Row>';

        $xml .= '</Table></Worksheet></Workbook>';

        return $xml;
    }

    public function bulkCsv(iterable $products): string
    {
        $rows = [$this->headers()];

        foreach ($products as $product) {
            $rows[] = $this->productRow($product, $product->generated_content ?? []);
        }

        return $this->buildCsv($rows);
    }

    private function headers(): array
    {
        return [
            'Product Name',
            'SEO Score',
            'SEO Title',
            'Description',
            'Short Description',
            'Meta Title',
            'Meta Description',
            'Image Alt Text',
            'Keywords',
            'Tags',
            'Features',
            'Benefits',
            'FAQs',
            'Language',
            'Tone',
            'Category',
            'Created At',
        ];
    }

    private function productRow(Product $product, array $content): array
    {
        $faqs = collect($content['faqs'] ?? [])
            ->map(fn ($f) => 'Q: '.($f['question'] ?? '').' | A: '.($f['answer'] ?? ''))
            ->implode(' || ');

        return [
            $product->product_name ?? '',
            (string) ($product->seo_score ?? ''),
            $content['seo_title'] ?? '',
            $content['description'] ?? '',
            $content['short_description'] ?? '',
            $content['meta_title'] ?? '',
            $content['meta_description'] ?? '',
            $content['image_alt_text'] ?? '',
            implode(', ', $content['keywords'] ?? []),
            implode(', ', $content['tags'] ?? []),
            implode(' | ', $content['features'] ?? []),
            implode(' | ', $content['benefits'] ?? []),
            $faqs,
            $product->language ?? '',
            $product->tone ?? '',
            $product->category ?? '',
            $product->created_at?->toDateTimeString() ?? '',
        ];
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

    private function escapeXml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
