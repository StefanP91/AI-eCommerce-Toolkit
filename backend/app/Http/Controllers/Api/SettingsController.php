<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class SettingsController extends Controller
{
  public function update(Request $request): JsonResponse
  {
    $user = $request->user();

    $validated = $request->validate([
      'name' => ['sometimes', 'string', 'max:255'],
      'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$user->id],
      'current_password' => ['required_with:password'],
      'password' => ['sometimes', 'confirmed', Password::defaults()],
    ]);

    if (isset($validated['password'])) {
      if (! isset($validated['current_password']) || ! \Hash::check($validated['current_password'], $user->password)) {
        return response()->json(['message' => 'Current password is incorrect.'], 422);
      }
      $user->password = $validated['password'];
    }

    if (isset($validated['name'])) {
      $user->name = $validated['name'];
    }

    if (isset($validated['email'])) {
      $user->email = $validated['email'];
    }

    $user->save();

    return response()->json($user);
  }
}
