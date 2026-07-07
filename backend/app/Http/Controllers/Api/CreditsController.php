<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesAiCredits;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreditsController extends Controller
{
    use ManagesAiCredits;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json($this->creditsSummary($user));
    }
}
