<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GenerationHistory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('status', 'active')->count(),
            'suspended_users' => User::where('status', 'suspended')->count(),
            'pro_users' => User::where('plan', 'pro')->count(),
            'total_products' => Product::count(),
            'total_generations' => GenerationHistory::count(),
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
}
