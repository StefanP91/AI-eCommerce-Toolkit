<?php

namespace App\Services;

use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class StorefrontSessionService
{
    public function create(string $baseUrl, ?string $visitorPassword = null): PendingRequest
    {
        $jar = new CookieJar();

        $client = Http::withOptions([
            'cookies' => $jar,
            'allow_redirects' => true,
        ])->withHeaders([
            'User-Agent' => 'Mozilla/5.0 (compatible; AICommerceSuite/1.0; +https://ai-ecommerce-suite.netlify.app)',
            'Accept' => 'text/html,application/xhtml+xml,application/xml,text/xml,*/*',
        ])->timeout(20);

        if ($visitorPassword !== null && $visitorPassword !== '') {
            $this->authenticateIfNeeded($client, $baseUrl, $visitorPassword);
        }

        return $client;
    }

    public function isPasswordProtectedHtml(?string $html): bool
    {
        if (! $html) {
            return false;
        }

        $needles = [
            'password protected',
            'Enter store password',
            'storefront_password',
            'This store is password protected',
        ];

        foreach ($needles as $needle) {
            if (stripos($html, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    private function authenticateIfNeeded(PendingRequest $client, string $baseUrl, string $password): void
    {
        $response = $client->get($baseUrl);
        $html = $response->body();

        if (! $this->isPasswordProtectedHtml($html)) {
            return;
        }

        if (! preg_match('/name="authenticity_token"\s+value="([^"]+)"/', $html, $matches)) {
            throw new \RuntimeException('Could not start visitor password authentication for this store.');
        }

        $client->asForm()->post(rtrim($baseUrl, '/').'/password', [
            'authenticity_token' => html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5),
            'password' => $password,
        ]);

        $verify = $client->get($baseUrl);
        if ($this->isPasswordProtectedHtml($verify->body())) {
            throw new \RuntimeException('Visitor password is incorrect. Check your store password and try again.');
        }
    }
}
