<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GenerationHistory;
use App\Models\PageVisit;
use App\Models\Product;
use App\Models\SupportRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $today = now()->startOfDay();
        $weekStart = now()->startOfWeek();

        $visitsByCountry = PageVisit::query()
            ->select(
                'country_code',
                DB::raw('MAX(country_name) as country_name'),
                DB::raw('COUNT(*) as visits'),
                DB::raw('COUNT(DISTINCT visitor_hash) as unique_visitors')
            )
            ->whereNotNull('country_code')
            ->groupBy('country_code')
            ->orderByDesc('visits')
            ->limit(15)
            ->get();

        $unknownVisits = PageVisit::whereNull('country_code')->count();

        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('status', 'active')->count(),
            'suspended_users' => User::where('status', 'suspended')->count(),
            'pro_users' => User::where('plan', 'pro')->count(),
            'total_products' => Product::count(),
            'total_generations' => GenerationHistory::count(),
            'visits' => [
                'total' => PageVisit::count(),
                'today' => PageVisit::where('created_at', '>=', $today)->count(),
                'this_week' => PageVisit::where('created_at', '>=', $weekStart)->count(),
                'unique_today' => PageVisit::where('created_at', '>=', $today)->distinct('visitor_hash')->count('visitor_hash'),
                'by_country' => $visitsByCountry,
                'unknown_country' => $unknownVisits,
            ],
            'open_support_requests' => SupportRequest::where('status', 'open')->count(),
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $search = $request->query('search');

        $users = User::query()
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->withCount(['products', 'generationHistories'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($users);
    }

    public function supportRequests(Request $request): JsonResponse
    {
        $requests = SupportRequest::query()
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->paginate(10);

        return response()->json($requests);
    }

    public function updateSupportRequest(Request $request, SupportRequest $supportRequest): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:open,closed'],
        ]);

        $supportRequest->update($validated);

        return response()->json([
            'message' => 'Support request updated.',
            'request' => $supportRequest->load('user:id,name,email'),
        ]);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'plan' => ['sometimes', 'in:free,pro'],
            'status' => ['sometimes', 'in:active,suspended'],
            'role' => ['sometimes', 'in:user,admin'],
        ]);

        $admin = $request->user();

        if (isset($validated['status']) && $validated['status'] === 'suspended' && $user->id === $admin->id) {
            return response()->json(['message' => 'You cannot suspend your own account.'], 422);
        }

        if (isset($validated['role']) && $validated['role'] === 'user' && $user->id === $admin->id) {
            return response()->json(['message' => 'You cannot remove your own admin role.'], 422);
        }

        if (isset($validated['role']) && $validated['role'] === 'user' && $user->isAdmin()) {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json(['message' => 'At least one admin account must remain.'], 422);
            }
        }

        $user->update($validated);

        if (isset($validated['status']) && $validated['status'] === 'suspended') {
            $user->tokens()->delete();
        }

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user->fresh()->loadCount(['products', 'generationHistories']),
        ]);
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        $admin = $request->user();

        if ($user->id === $admin->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        if ($user->isAdmin()) {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json(['message' => 'At least one admin account must remain.'], 422);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }
}
