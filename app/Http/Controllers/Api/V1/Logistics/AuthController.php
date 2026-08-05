<?php

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\LogisticsLoginRequest;
use App\Http\Resources\Logistics\LogisticsUserResource;
use App\Models\LogisticsUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LogisticsLoginRequest $request): JsonResponse
    {
        /** @var LogisticsUser|null $user */
        $user = LogisticsUser::where('mobile', $request->input('mobile'))->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'mobile' => ['These credentials do not match our records.'],
            ]);
        }

        // Rule 9: deactivated users cannot authenticate.
        if (! $user->is_active) {
            return response()->json([
                'message' => 'Your account has been deactivated. Please contact your administrator.',
            ], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        // One active device token per account: issuing a new one retires the old.
        $user->tokens()->delete();
        $token = $user->createToken('logistics-mobile')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => new LogisticsUserResource($user->load('location.stops', 'defaultStop')),
                'token' => $token,
                'permissions' => $this->permissions($user),
            ],
            'message' => 'Login successful',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Successfully logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var LogisticsUser $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'user' => new LogisticsUserResource($user->load('location.stops', 'defaultStop')),
                'permissions' => $this->permissions($user),
            ],
        ]);
    }

    /**
     * @return array<string, bool>
     */
    private function permissions(LogisticsUser $user): array
    {
        return [
            'is_central' => (bool) $user->is_central,
            'can_send' => true,
            'can_receive' => true,
        ];
    }
}
