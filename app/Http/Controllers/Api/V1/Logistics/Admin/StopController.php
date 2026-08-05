<?php

namespace App\Http\Controllers\Api\V1\Logistics\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StopRequest;
use App\Http\Resources\Logistics\StopResource;
use App\Models\LogisticsUser;
use App\Models\Stop;
use Illuminate\Http\JsonResponse;

class StopController extends Controller
{
    public function store(StopRequest $request): JsonResponse
    {
        $stop = Stop::create($request->validated());

        return (new StopResource($stop->load('location')))
            ->additional(['message' => "{$stop->name} added."])
            ->response()
            ->setStatusCode(201);
    }

    public function update(StopRequest $request, Stop $stop): JsonResponse
    {
        $stop->update($request->validated());

        return (new StopResource($stop->fresh('location')))
            ->additional(['message' => "{$stop->name} updated."])
            ->response();
    }

    /**
     * Deleting a stop is soft: dispatches reference stops with a
     * restrictOnDelete foreign key and resolve them withTrashed(), so an old
     * dispatch keeps showing the bus stand it actually used.
     *
     * The one thing that must not happen is leaving staff at a location with
     * nowhere to hand a package over.
     */
    public function destroy(Stop $stop): JsonResponse
    {
        $stop->loadMissing('location');

        $remaining = Stop::where('location_id', $stop->location_id)
            ->whereKeyNot($stop->id)
            ->count();

        if ($remaining === 0) {
            $activeUsers = LogisticsUser::where('location_id', $stop->location_id)
                ->where('is_active', true)
                ->count();

            if ($activeUsers > 0) {
                return response()->json([
                    'message' => "{$stop->name} is the last stop at {$stop->location?->name}, which still has "
                        . "{$activeUsers} active user(s). Add another stop or remove those users first.",
                ], 422);
            }
        }

        // Anyone defaulting to this stop loses the shortcut, not their account.
        LogisticsUser::where('default_stop_id', $stop->id)->update(['default_stop_id' => null]);

        $stop->delete();

        return response()->json(['message' => "{$stop->name} deleted."]);
    }

    /**
     * Rule 5 of the locked decisions: every location must keep at least one
     * active stop, so the last one cannot be switched off.
     */
    public function toggleStatus(Stop $stop): JsonResponse
    {
        if ($stop->is_active) {
            $remaining = Stop::where('location_id', $stop->location_id)
                ->where('is_active', true)
                ->whereKeyNot($stop->id)
                ->count();

            if ($remaining === 0) {
                $stop->loadMissing('location');

                return response()->json([
                    'message' => "{$stop->location?->name} must keep at least one active stop. "
                        . 'Add another stop before deactivating this one.',
                ], 422);
            }
        }

        $stop->update(['is_active' => ! $stop->is_active]);

        return response()->json([
            'data' => new StopResource($stop->fresh('location')),
            'message' => $stop->is_active
                ? "{$stop->name} activated."
                : "{$stop->name} deactivated.",
        ]);
    }
}
