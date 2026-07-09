<?php

namespace App\Services;

use App\Models\StoreConnection;
use App\Models\User;

class StoreContextAuditService
{
    public function __construct(
        private SeoAuditService $auditService,
        private StoreSitemapService $sitemapService,
        private StorefrontSessionService $sessionService,
    ) {}

    public function auditUrlForUser(?User $user, string $url, bool $bustCache = false): array
    {
        $http = null;

        if ($user) {
            $store = StoreConnection::where('user_id', $user->id)->first();
            if ($store && $this->urlBelongsToStore($url, $store->store_url)) {
                $http = $this->sessionService->create(
                    $this->sitemapService->normalizeBaseUrl($store->store_url),
                    $store->store_password,
                );
            }
        }

        return $this->auditService->auditUrl($url, $http, $bustCache);
    }

    private function urlBelongsToStore(string $url, string $storeUrl): bool
    {
        $urlHost = strtolower(parse_url($url, PHP_URL_HOST) ?? '');
        $storeHost = strtolower(parse_url($storeUrl, PHP_URL_HOST) ?? '');

        if ($urlHost === '' || $storeHost === '') {
            return false;
        }

        return $urlHost === $storeHost;
    }
}
