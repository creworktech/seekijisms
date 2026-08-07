<?php

namespace App\Http\Controllers\Web;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Logistics\DispatchResource;
use App\Http\Resources\Logistics\LocationResource;
use App\Http\Resources\Logistics\LogisticsUserResource;
use App\Http\Resources\Logistics\StopResource;
use App\Models\Dispatch;
use App\Models\Location;
use App\Models\LogisticsUser;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inertia pages for the logistics admin panel.
 *
 * Reads happen here so pages arrive fully rendered. Writes go through the
 * already-validated /api/v1/logistics/admin endpoints via axios, then the
 * page reloads its props — no business rule is duplicated in two places.
 */
class LogisticsController extends Controller
{
    public function dashboard(): Response
    {
        return Inertia::render('Logistics/Dashboard', [
            'stats' => $this->totals(),
            'perLocation' => $this->perLocation(),
            'recentDispatches' => DispatchResource::collection(
                Dispatch::with(['sender.location', 'receiver.location', 'fromStop', 'toStop'])
                    ->latest('id')
                    ->limit(10)
                    ->get()
            )->resolve(),
        ]);
    }

    public function dispatches(Request $request): Response
    {
        $dispatches = $this->filtered($request)
            ->with(['sender.location', 'receiver.location', 'fromStop', 'toStop'])
            ->latest('dispatch_date')
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Logistics/Dispatches', [
            'dispatches' => DispatchResource::collection($dispatches)->response()->getData(true),
            'locations' => LocationResource::collection(Location::orderBy('name')->get())->resolve(),
            'filters' => $request->only(['search', 'status', 'from', 'to', 'location_id']),
            'logisticsUsers' => $this->logisticsUsersForPicker(),
            'stopsByLocation' => $this->stopsByLocation(),
        ]);
    }

    public function dispatchDetail(Dispatch $dispatch): Response
    {
        $dispatch->load([
            'sender.location', 'receiver.location', 'receivedBy',
            'fromStop', 'toStop', 'photos', 'events.user',
        ]);

        return Inertia::render('Logistics/DispatchDetail', [
            'dispatch' => (new DispatchResource($dispatch))->resolve(),
            'logisticsUsers' => $this->logisticsUsersForPicker(),
        ]);
    }

    /**
     * Every active logistics user, for the admin's sender/receiver/confirming
     * pickers when creating or confirming a dispatch on someone's behalf.
     */
    private function logisticsUsersForPicker()
    {
        return LogisticsUserResource::collection(
            LogisticsUser::query()
                ->active()
                ->with('location')
                ->whereHas('location', fn ($q) => $q->where('is_active', true))
                ->orderBy('name')
                ->get()
        )->resolve();
    }

    /**
     * Active stops grouped by location id, so the create-dispatch modal can
     * repopulate the stop dropdown without a round trip when the sender or
     * receiver changes.
     */
    private function stopsByLocation()
    {
        return Location::with('stops')->get()
            ->mapWithKeys(fn (Location $l) => [
                $l->id => StopResource::collection($l->stops->where('is_active', true)->values())->resolve(),
            ]);
    }

    public function users(Request $request): Response
    {
        $users = LogisticsUser::query()
            ->with(['location', 'defaultStop'])
            ->when($request->filled('location_id'), fn ($q) => $q->where('location_id', $request->query('location_id')))
            ->when($request->filled('role'), fn ($q) => $q->where('is_central', $request->query('role') === 'central'))
            ->when($request->filled('active') && $request->query('active') !== '', function ($q) use ($request) {
                $q->where('is_active', $request->query('active') === '1');
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->query('search') . '%';
                $q->where(fn ($sub) => $sub->where('name', 'like', $term)->orWhere('mobile', 'like', $term));
            })
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Logistics/Users', [
            'users' => LogisticsUserResource::collection($users)->response()->getData(true),
            'locations' => LocationResource::collection(
                Location::with('activeStops')->orderByDesc('is_central')->orderBy('name')->get()
            )->resolve(),
            // Stops are sent per location so the modal's dropdown can
            // repopulate without a round trip when the location changes.
            'stopsByLocation' => Location::with('stops')->get()
                ->mapWithKeys(fn (Location $l) => [
                    $l->id => StopResource::collection($l->stops->where('is_active', true)->values())->resolve(),
                ]),
            'filters' => $request->only(['search', 'location_id', 'role', 'active']),
        ]);
    }

    public function settings(Request $request): Response
    {
        $locations = Location::withCount(['stops', 'activeUsers'])
            ->orderByDesc('is_central')
            ->orderBy('name')
            ->get();

        $selectedId = $request->query('location_id') ?: $locations->first()?->id;

        $selected = $selectedId ? Location::find($selectedId) : null;

        return Inertia::render('Logistics/Settings', [
            'locations' => LocationResource::collection($locations)->resolve(),
            'selectedLocationId' => $selectedId ? (int) $selectedId : null,
            'stops' => $selected
                ? StopResource::collection($selected->stops()->orderBy('name')->get())->resolve()
                : [],
        ]);
    }

    private function totals(): array
    {
        $byStatus = Dispatch::query()
            ->select('status', DB::raw('count(*) as aggregate'))
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return [
            'total' => (int) $byStatus->sum(),
            'pending' => (int) ($byStatus[DispatchStatus::PENDING->value] ?? 0),
            'received' => (int) ($byStatus[DispatchStatus::RECEIVED->value] ?? 0),
            'not_received' => (int) ($byStatus[DispatchStatus::NOT_RECEIVED->value] ?? 0),
            'received_today' => Dispatch::where('status', DispatchStatus::RECEIVED)
                ->whereDate('received_at', today())
                ->count(),
        ];
    }

    /**
     * Sent counts key off the sender's location; pending, received and
     * not-received key off the receiver's, so each row reads as "what this
     * town sent" and "what this town was due to collect".
     */
    private function perLocation(): array
    {
        $sent = Dispatch::query()
            ->join('logistics_users as senders', 'senders.id', '=', 'dispatches.sender_id')
            ->select('senders.location_id', DB::raw('count(*) as aggregate'))
            ->groupBy('senders.location_id')
            ->pluck('aggregate', 'location_id');

        $inbound = Dispatch::query()
            ->join('logistics_users as receivers', 'receivers.id', '=', 'dispatches.receiver_id')
            ->select('receivers.location_id', 'dispatches.status', DB::raw('count(*) as aggregate'))
            ->groupBy('receivers.location_id', 'dispatches.status')
            ->get();

        return Location::orderByDesc('is_central')->orderBy('name')->get()
            ->map(function (Location $location) use ($sent, $inbound) {
                $rows = $inbound->where('location_id', $location->id);

                return [
                    'location_id' => $location->id,
                    'location' => $location->name,
                    'is_central' => (bool) $location->is_central,
                    'sent' => (int) ($sent[$location->id] ?? 0),
                    'pending' => (int) ($rows->firstWhere('status', DispatchStatus::PENDING->value)->aggregate ?? 0),
                    'received' => (int) ($rows->firstWhere('status', DispatchStatus::RECEIVED->value)->aggregate ?? 0),
                    'not_received' => (int) ($rows->firstWhere('status', DispatchStatus::NOT_RECEIVED->value)->aggregate ?? 0),
                ];
            })->all();
    }

    private function filtered(Request $request): Builder
    {
        return Dispatch::query()
            ->when(
                $request->filled('status') && in_array($request->query('status'), DispatchStatus::values(), true),
                fn ($q) => $q->where('status', $request->query('status'))
            )
            ->when($request->filled('from'), fn ($q) => $q->whereDate('dispatch_date', '>=', $request->query('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('dispatch_date', '<=', $request->query('to')))
            ->when($request->filled('location_id'), function ($q) use ($request) {
                $locationId = $request->query('location_id');

                $q->where(function ($sub) use ($locationId) {
                    $sub->whereHas('sender', fn ($s) => $s->where('location_id', $locationId))
                        ->orWhereHas('receiver', fn ($s) => $s->where('location_id', $locationId));
                });
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->query('search') . '%';

                $q->where(function ($sub) use ($term) {
                    $sub->where('reference_no', 'like', $term)
                        ->orWhereHas('sender', fn ($s) => $s->where('name', 'like', $term))
                        ->orWhereHas('receiver', fn ($s) => $s->where('name', 'like', $term));
                });
            });
    }
}
