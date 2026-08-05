<?php

namespace App\Http\Controllers\Api\V1\Logistics\Admin;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Logistics\DispatchResource;
use App\Models\Dispatch;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'data' => [
                'totals' => $this->totals(),
                'per_location' => $this->perLocation(),
                'needs_attention' => DispatchResource::collection(
                    Dispatch::with(['sender.location', 'receiver.location', 'fromStop', 'toStop'])
                        ->where('status', DispatchStatus::NOT_RECEIVED)
                        ->latest('received_at')
                        ->limit(10)
                        ->get()
                ),
                'recent' => DispatchResource::collection(
                    Dispatch::with(['sender.location', 'receiver.location', 'fromStop', 'toStop'])
                        ->latest('id')
                        ->limit(10)
                        ->get()
                ),
            ],
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
     * Sent counts key off the sender's location; the received, pending and
     * not-received columns key off the receiver's, so each row reads as
     * "what this town sent" and "what this town was due to collect".
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

        return Location::orderByDesc('is_central')->orderBy('name')->get()->map(function (Location $location) use ($sent, $inbound) {
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
}
