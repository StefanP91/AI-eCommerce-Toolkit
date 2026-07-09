<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
  public function register(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'name' => ['required', 'string', 'max:255'],
      'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
      'password' => ['required', 'confirmed', PasswordRule::defaults()],
    ]);

    $user = User::create([
      'name' => $validated['name'],
      'email' => $validated['email'],
      'password' => $validated['password'],
      'last_login_at' => now(),
    ]);

    $token = $user->createToken('auth-token')->plainTextToken;

    return response()->json([
      'user' => $user,
      'token' => $token,
    ], 201);
  }

  public function login(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'email' => ['required', 'email'],
      'password' => ['required'],
    ]);

    $user = User::where('email', $validated['email'])->first();

    if (! $user || ! Hash::check($validated['password'], $user->password)) {
      throw ValidationException::withMessages([
        'email' => ['The provided credentials are incorrect.'],
      ]);
    }

    if (! $user->isActive()) {
      throw ValidationException::withMessages([
        'email' => ['Your account has been suspended. Contact support.'],
      ]);
    }

    $user->update(['last_login_at' => now()]);

    $token = $user->createToken('auth-token')->plainTextToken;

    return response()->json([
      'user' => $user,
      'token' => $token,
    ]);
  }

  public function logout(Request $request): JsonResponse
  {
    $request->user()->currentAccessToken()->delete();

    return response()->json(['message' => 'Logged out successfully']);
  }

  public function user(Request $request): JsonResponse
  {
    return response()->json($request->user());
  }

  public function forgotPassword(Request $request): JsonResponse
  {
    $request->validate(['email' => ['required', 'email']]);

    $status = Password::sendResetLink($request->only('email'));

    if ($status !== Password::RESET_LINK_SENT) {
      throw ValidationException::withMessages([
        'email' => [__($status)],
      ]);
    }

    return response()->json(['message' => 'Password reset link sent to your email.']);
  }

  public function resetPassword(Request $request): JsonResponse
  {
    $request->validate([
      'token' => ['required'],
      'email' => ['required', 'email'],
      'password' => ['required', 'confirmed', PasswordRule::defaults()],
    ]);

    $status = Password::reset(
      $request->only('email', 'password', 'password_confirmation', 'token'),
      function (User $user, string $password) {
        $user->forceFill(['password' => $password])->save();
        $user->tokens()->delete();
      }
    );

    if ($status !== Password::PASSWORD_RESET) {
      throw ValidationException::withMessages([
        'email' => [__($status)],
      ]);
    }

    return response()->json(['message' => 'Password reset successfully.']);
  }
}
