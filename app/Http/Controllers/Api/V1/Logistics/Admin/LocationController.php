<?php

namespace App\Http\Controllers\Api\V1\Logistics\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\LocationRequest;
use App\Http\Resources\Logistics\LocationResource;
use App\Http\Resources\Logistics\StopResource;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LocationController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $locations = Location::query()
            ->withCount(['stops', 'activeUsers'])
            ->orderByDesc('is_central')
            ->orderBy('name')
            ->get();

        return LocationResource::collection($locations);
    }

    public function store(LocationRequest $request): JsonResponse
    {
        $location = Location::create($request->validated());

        return (new LocationResource($location->loadCount(['stops', 'activeUsers'])))
            ->additional(['message' => "{$location->name} added."])
            ->response()
            ->setStatusCode(201);
    }

    public function update(LocationRequest $request, Location $location): JsonResponse
    {
        $location->update($request->validated());

        return (new LocationResource($location->fresh()->loadCount(['stops', 'activeUsers'])))
            ->additional(['message' => "{$location->name} updated."])
            ->response();
    }

    /**
     * Rule 10: locations are deactivated, never deleted — past dispatches
     * still reference them. Rule 11: not while active users remain.
     */
    public function toggleStatus(Location $location): JsonResponse
    {
        if ($location->is_active) {
            $activeUsers = $location->activeUsers()->count();

            if ($activeUsers > 0) {
                return response()->json([
                    'message' => "{$location->name} still has {$activeUsers} active user(s). "
                        . 'Deactivate or move them before deactivating this location.',
                ], 422);
            }
        }

        $location->update(['is_active' => ! $location->is_active]);

        return response()->json([
            'data' => new LocationResource($location->fresh()->loadCount(['stops', 'activeUsers'])),
            'message' => $location->is_active
                ? "{$location->name} activated."
                : "{$location->name} deactivated.",
        ]);
    }

    /**
     * A location may only be deleted once nothing hangs off it. Stops carry a
     * restrictOnDelete foreign key to locations and users carry another, so
     * the checks below are the readable form of what the database would
     * otherwise refuse.
     */
    public function destroy(Location $location): JsonResponse
    {
        $stops = $location->stops()->count();

        if ($stops > 0) {
            return response()->json([
                'message' => "{$location->name} still has {$stops} stop(s). Delete its stops first.",
            ], 422);
        }

        $users = $location->users()->count();

        if ($users > 0) {
            return response()->json([
                'message' => "{$location->name} still has {$users} user(s). Remove them first.",
            ], 422);
        }

        $location->delete();

        return response()->json(['message' => "{$location->name} deleted."]);
    }

    public function stops(Location $location): AnonymousResourceCollection
    {
        return StopResource::collection(
            $location->stops()->orderBy('name')->get()
        );
    }
}
