<?php

namespace App\Http\Controllers\Api\V1\Logistics\Admin;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\LogisticsUserStoreRequest;
use App\Http\Requests\Logistics\LogisticsUserUpdateRequest;
use App\Http\Requests\Logistics\ResetPasswordRequest;
use App\Http\Resources\Logistics\LogisticsUserResource;
use App\Models\Dispatch;
use App\Models\LogisticsUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $users = LogisticsUser::query()
            ->with(['location', 'defaultStop'])
            ->when($request->filled('location_id'), fn ($q) => $q->where('location_id', $request->query('location_id')))
            ->when($request->filled('role'), fn ($q) => $q->where('is_central', $request->query('role') === 'central'))
            ->when($request->filled('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->query('search') . '%';
                $q->where(fn ($sub) => $sub->where('name', 'like', $term)->orWhere('mobile', 'like', $term));
            })
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        return LogisticsUserResource::collection($users);
    }

    public function store(LogisticsUserStoreRequest $request): JsonResponse
    {
        $user = LogisticsUser::create($request->validated());

        return (new LogisticsUserResource($user->load('location', 'defaultStop')))
            ->additional(['message' => "{$user->name} added."])
            ->response()
            ->setStatusCode(201);
    }

    public function update(LogisticsUserUpdateRequest $request, LogisticsUser $logisticsUser): JsonResponse
    {
        $data = $request->validated();

        // Password is only rotated through the reset endpoint.
        unset($data['password']);

        $logisticsUser->update($data);

        return (new LogisticsUserResource($logisticsUser->fresh(['location', 'defaultStop'])))
            ->additional(['message' => "{$logisticsUser->name} updated."])
            ->response();
    }

    public function toggleStatus(LogisticsUser $logisticsUser): JsonResponse
    {
        $logisticsUser->update(['is_active' => ! $logisticsUser->is_active]);

        if (! $logisticsUser->is_active) {
            // A deactivated account must not keep a usable session.
            $logisticsUser->tokens()->delete();
        }

        return response()->json([
            'data' => new LogisticsUserResource($logisticsUser->fresh(['location', 'defaultStop'])),
            'message' => $logisticsUser->is_active
                ? "{$logisticsUser->name} activated."
                : "{$logisticsUser->name} deactivated.",
        ]);
    }

    /**
     * Soft delete. The row stays so past dispatches keep resolving their
     * sender, receiver and confirming user — every dispatch relation is
     * declared withTrashed() for exactly this reason. A hard delete is
     * impossible anyway: the dispatch foreign keys are restrictOnDelete.
     */
    public function destroy(LogisticsUser $logisticsUser): JsonResponse
    {
        if ($blocker = $this->wouldStrandPendingDispatches($logisticsUser)) {
            return response()->json(['message' => $blocker], 422);
        }

        $logisticsUser->tokens()->delete();
        $logisticsUser->delete();

        return response()->json(['message' => "{$logisticsUser->name} removed."]);
    }

    /**
     * Removing the last active person at a location leaves anything already
     * on a bus to that location with nobody able to confirm it, and only the
     * receiving side may change a status.
     */
    private function wouldStrandPendingDispatches(LogisticsUser $user): ?string
    {
        $colleaguesRemain = LogisticsUser::query()
            ->active()
            ->where('location_id', $user->location_id)
            ->whereKeyNot($user->id)
            ->exists();

        if ($colleaguesRemain) {
            return null;
        }

        $stranded = Dispatch::query()
            ->where('status', DispatchStatus::PENDING)
            ->whereHas('receiver', fn ($q) => $q->where('location_id', $user->location_id))
            ->count();

        if ($stranded === 0) {
            return null;
        }

        $user->loadMissing('location');

        return "{$user->name} is the last active user at {$user->location?->name}, and {$stranded} "
            . 'dispatch(es) are still on the way there. Those packages could not be received by anyone. '
            . 'Add another user at this location first, or wait until they are confirmed.';
    }

    /**
     * Admin-only password reset. The admin chooses the password so they can
     * agree it with the user directly; it is never echoed back in the
     * response, since the person setting it already knows it.
     */
    public function resetPassword(ResetPasswordRequest $request, LogisticsUser $logisticsUser): JsonResponse
    {
        $logisticsUser->update(['password' => $request->input('password')]);

        // Any device still holding a token must be signed out.
        $logisticsUser->tokens()->delete();

        return response()->json([
            'message' => "Password reset for {$logisticsUser->name}.",
        ]);
    }
}
