<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserStoreRequest;
use App\Http\Requests\UserUpdateRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = User::with('roles');

        if ($role = $request->input('role')) {
            $query->role($role);
        }

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 25), 100);

        return UserResource::collection($query->latest()->paginate($perPage));
    }

    public function store(UserStoreRequest $request): JsonResponse
    {
        $data = $request->validated();
        $role = $data['role'];
        unset($data['role']);

        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = $data['is_active'] ?? true;

        /** @var User $user */
        $user = User::create($data);
        $user->assignRole($role);

        return response()->json([
            'data' => new UserResource($user->fresh('roles')),
            'message' => 'User created successfully',
        ], 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($user->load('roles')),
        ], 200);
    }

    public function update(UserUpdateRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
            unset($data['role']);
        }

        $user->update($data);

        return response()->json([
            'data' => new UserResource($user->fresh('roles')),
            'message' => 'User updated successfully',
        ], 200);
    }

    public function toggleStatus(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'You cannot deactivate your own account.',
            ], 422);
        }

        if ($user->is_active && $user->hasRole('admin')) {
            $activeAdminsCount = User::role('admin')->where('is_active', true)->count();
            if ($activeAdminsCount <= 1) {
                return response()->json([
                    'message' => 'Cannot deactivate the last active admin.',
                ], 422);
            }
        }

        $user->update(['is_active' => ! $user->is_active]);

        return response()->json([
            'data' => new UserResource($user->fresh('roles')),
            'message' => 'User status updated successfully',
        ], 200);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 422);
        }

        if ($user->hasRole('admin')) {
            $activeAdminsCount = User::role('admin')->where('is_active', true)->count();
            if ($activeAdminsCount <= 1) {
                return response()->json([
                    'message' => 'Cannot delete the last active admin.',
                ], 422);
            }
        }

        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully',
        ], 200);
    }
}
