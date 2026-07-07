<?php

namespace App\Services;

use RuntimeException;

class ProductImportService
{
    public const MAX_ROWS = 100;

    private const HEADER_MAP = [
        'product_name' => ['product_name', 'name', 'product', 'title', 'product name'],
        'product_url' => ['product_url', 'url', 'link', 'product url'],
        'manual_info' => ['manual_info', 'info', 'description', 'details', 'manual info'],
        'category' => ['category', 'cat'],
        'language' => ['language', 'lang'],
        'tone' => ['tone', 'style'],
        'target_country' => ['target_country', 'country', 'target country'],
    ];

    public function parseFile(string $contents, string $filename): array
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        $rows = match ($extension) {
            'csv', 'txt' => $this->parseCsv($contents),
            'xls', 'xml' => $this->parseExcelXml($contents),
            default => throw new RuntimeException('Unsupported file type. Upload CSV or Excel (.xls).'),
        };

        if (count($rows) === 0) {
            throw new RuntimeException('The file is empty or has no data rows.');
        }

        if (count($rows) > self::MAX_ROWS) {
            throw new RuntimeException('Maximum '.self::MAX_ROWS.' products per upload. Split your file into smaller batches.');
        }

        return $rows;
    }

    public function templateCsv(): string
    {
        $rows = [
            ['product_name', 'product_url', 'category', 'language', 'tone', 'target_country'],
            ['Wireless Gaming Mouse', '', 'Electronics', 'en', 'professional', 'US'],
            ['LED Desk Lamp', 'https://example.com/lamp', 'Home & Garden', 'en', 'luxury', 'UK'],
        ];

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

    private function parseCsv(string $contents): array
    {
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents);
        $lines = preg_split('/\r\n|\r|\n/', trim($contents));

        if (empty($lines)) {
            return [];
        }

        $headers = str_getcsv(array_shift($lines));
        $mapped = $this->mapHeaders($headers);
        $rows = [];

        foreach ($lines as $index => $line) {
            if (trim($line) === '') {
                continue;
            }

            $values = str_getcsv($line);
            $row = $this->buildRow($mapped, $values, $index + 2);

            if ($row !== null) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function parseExcelXml(string $contents): array
    {
        if (! str_contains($contents, '<Workbook') && ! str_contains($contents, '<Table')) {
            throw new RuntimeException('Invalid Excel file. Save as .xls (XML) or use CSV.');
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($contents);

        if ($xml === false) {
            throw new RuntimeException('Could not parse Excel file.');
        }

        $xml->registerXPathNamespace('ss', 'urn:schemas-microsoft-com:office:spreadsheet');
        $tableRows = $xml->xpath('//ss:Row');

        if (empty($tableRows)) {
            return [];
        }

        $headerCells = $this->excelRowCells($tableRows[0]);
        $mapped = $this->mapHeaders($headerCells);
        $rows = [];

        foreach (array_slice($tableRows, 1) as $i => $tableRow) {
            $values = $this->excelRowCells($tableRow);
            $row = $this->buildRow($mapped, $values, $i + 2);

            if ($row !== null) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function excelRowCells(\SimpleXMLElement $row): array
    {
        $row->registerXPathNamespace('ss', 'urn:schemas-microsoft-com:office:spreadsheet');
        $cells = $row->xpath('ss:Cell/ss:Data');

        $values = [];

        foreach ($cells as $cell) {
            $values[] = trim((string) $cell);
        }

        return $values;
    }

    private function mapHeaders(array $headers): array
    {
        $mapped = [];

        foreach ($headers as $index => $header) {
            $normalized = strtolower(trim($header));

            foreach (self::HEADER_MAP as $field => $aliases) {
                if (in_array($normalized, $aliases, true)) {
                    $mapped[$field] = $index;
                    break;
                }
            }
        }

        if (! isset($mapped['product_name']) && ! isset($mapped['product_url']) && ! isset($mapped['manual_info'])) {
            throw new RuntimeException('File must include a product_name, product_url, or manual_info column.');
        }

        return $mapped;
    }

    private function buildRow(array $mapped, array $values, int $rowNumber): ?array
    {
        $get = function (string $field) use ($mapped, $values): ?string {
            if (! isset($mapped[$field])) {
                return null;
            }

            $value = trim($values[$mapped[$field]] ?? '');

            return $value !== '' ? $value : null;
        };

        $productName = $get('product_name');
        $productUrl = $get('product_url');
        $manualInfo = $get('manual_info');

        if (! $productName && ! $productUrl && ! $manualInfo) {
            return null;
        }

        $inputType = $productUrl ? 'url' : ($manualInfo && ! $productName ? 'manual' : 'name');

        return [
            'row_number' => $rowNumber,
            'input_type' => $inputType,
            'product_name' => $productName,
            'product_url' => $productUrl,
            'manual_info' => $manualInfo,
            'category' => $get('category'),
            'language' => $get('language'),
            'tone' => $get('tone'),
            'target_country' => $get('target_country'),
        ];
    }
}
