<?php

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Logistics\LocationResource;
use App\Http\Resources\Logistics\LogisticsUserResource;
use App\Http\Resources\Logistics\StopResource;
use App\Models\Dispatch;
use App\Models\LogisticsUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * One request on app launch instead of four. Everything the mobile app needs
 * to render the send form and the home screen badges.
 */
class BootstrapController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var LogisticsUser $user */
        $user = $request->user();
        $user->loadMissing('location.activeStops', 'defaultStop');

        $receivers = $this->receiversFor($user);

        return response()->json([
            'data' => [
                'user' => new LogisticsUserResource($user),

                'location' => new LocationResource($user->location),
                'stops' => StopResource::collection($user->location?->activeStops ?? collect()),

                // The app must not hardcode hub-and-spoke logic; this tells it
                // exactly who the current user may send to.
                'receivers' => $this->groupReceivers($receivers),

                'counts' => [
                    'send_pending' => Dispatch::where('sender_id', $user->id)
                        ->where('status', DispatchStatus::PENDING)
                        ->count(),

                    // Scoped to the location, not the individual — any active
                    // user at the receiving location may confirm.
                    'receive_pending' => Dispatch::where('status', DispatchStatus::PENDING)
                        ->whereHas('receiver', fn ($q) => $q->where('location_id', $user->location_id))
                        ->count(),
                ],
            ],
        ]);
    }

    /**
     * Rule 2 and 3, resolved server side.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, LogisticsUser>
     */
    private function receiversFor(LogisticsUser $user)
    {
        return LogisticsUser::query()
            ->active()
            ->with('location.activeStops')
            ->whereKeyNot($user->id)
            ->when(
                $user->isSpoke(),
                // A spoke user sends to the hub only.
                fn ($q) => $q->where('is_central', true),
                // A central user sends to any active spoke user.
                fn ($q) => $q->where('is_central', false)
            )
            ->whereHas('location', fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();
    }

    /**
     * Grouped by location so the central user's picker can show section
     * headers. Spoke users get a single group containing the hub.
     *
     * @param  \Illuminate\Database\Eloquent\Collection<int, LogisticsUser>  $receivers
     */
    private function groupReceivers($receivers): array
    {
        return $receivers
            ->groupBy(fn (LogisticsUser $r) => $r->location_id)
            ->map(fn ($group) => [
                'location' => new LocationResource($group->first()->location),
                'stops' => StopResource::collection($group->first()->location?->activeStops ?? collect()),
                'users' => LogisticsUserResource::collection($group->values()),
            ])
            ->values()
            ->all();
    }
}
