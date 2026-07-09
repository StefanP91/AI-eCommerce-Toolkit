<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class VisitorGeoService
{
    public function resolve(Request $request): array
    {
        $code = $this->fromHeaders($request);

        if ($code) {
            return [
                'country_code' => $code,
                'country_name' => $this->countryName($code),
            ];
        }

        $ip = $request->ip();
        if (! $ip || $this->isPrivateIp($ip)) {
            return ['country_code' => null, 'country_name' => null];
        }

        return $this->fromIpApi($ip);
    }

    public function visitorHash(Request $request): string
    {
        return hash('sha256', implode('|', [
            $request->ip() ?? 'unknown',
            $request->userAgent() ?? 'unknown',
        ]));
    }

    private function fromHeaders(Request $request): ?string
    {
        foreach (['CF-IPCountry', 'CloudFront-Viewer-Country', 'X-Country-Code', 'X-AppEngine-Country'] as $header) {
            $value = strtoupper(trim((string) $request->header($header)));
            if ($value && $value !== 'XX' && $value !== 'T1') {
                return substr($value, 0, 2);
            }
        }

        return null;
    }

    private function fromIpApi(string $ip): array
    {
        try {
            $response = Http::timeout(2)->get("http://ip-api.com/json/{$ip}", [
                'fields' => 'status,country,countryCode',
            ]);

            if (! $response->successful()) {
                return ['country_code' => null, 'country_name' => null];
            }

            $data = $response->json();
            if (($data['status'] ?? '') !== 'success') {
                return ['country_code' => null, 'country_name' => null];
            }

            return [
                'country_code' => $data['countryCode'] ?? null,
                'country_name' => $data['country'] ?? null,
            ];
        } catch (\Throwable) {
            return ['country_code' => null, 'country_name' => null];
        }
    }

    private function isPrivateIp(string $ip): bool
    {
        return ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }

    private function countryName(string $code): string
    {
        $names = [
            'MK' => 'North Macedonia',
            'US' => 'United States',
            'GB' => 'United Kingdom',
            'DE' => 'Germany',
            'FR' => 'France',
            'IT' => 'Italy',
            'ES' => 'Spain',
            'NL' => 'Netherlands',
            'CA' => 'Canada',
            'AU' => 'Australia',
            'IN' => 'India',
            'TR' => 'Turkey',
            'RS' => 'Serbia',
            'BG' => 'Bulgaria',
            'AL' => 'Albania',
            'GR' => 'Greece',
            'HR' => 'Croatia',
            'SI' => 'Slovenia',
            'BA' => 'Bosnia and Herzegovina',
            'ME' => 'Montenegro',
            'XK' => 'Kosovo',
        ];

        return $names[$code] ?? $code;
    }
}
