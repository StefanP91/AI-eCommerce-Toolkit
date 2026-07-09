<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PageVisit;
use App\Models\User;
use App\Services\VisitorGeoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class AnalyticsController extends Controller
{
    public function track(Request $request, VisitorGeoService $geo): JsonResponse
    {
        $validated = $request->validate([
            'path' => ['required', 'string', 'max:255'],
        ]);

        $path = '/'.ltrim($validated['path'], '/');
        $geoData = $geo->resolve($request);
        $user = $this->resolveUser($request);

        PageVisit::create([
            'path' => $path,
            'country_code' => $geoData['country_code'],
            'country_name' => $geoData['country_name'],
            'visitor_hash' => $geo->visitorHash($request),
            'user_id' => $user?->id,
            'created_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    private function resolveUser(Request $request): ?User
    {
        $token = $request->bearerToken();
        if (! $token) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($token);

        return $accessToken?->tokenable;
    }
}
