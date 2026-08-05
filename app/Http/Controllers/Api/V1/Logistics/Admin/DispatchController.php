<?php

namespace App\Http\Controllers\Api\V1\Logistics\Admin;

use App\Enums\DispatchStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Logistics\DispatchResource;
use App\Models\Dispatch;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DispatchController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $dispatches = $this->filtered($request)
            ->with(['sender.location', 'receiver.location', 'fromStop', 'toStop'])
            ->latest('dispatch_date')
            ->latest('id')
            ->paginate((int) $request->query('per_page', 25))
            ->withQueryString();

        return DispatchResource::collection($dispatches);
    }

    public function show(Dispatch $dispatch): DispatchResource
    {
        return new DispatchResource($dispatch->load([
            'sender.location', 'receiver.location', 'receivedBy',
            'fromStop', 'toStop', 'photos', 'events.user',
        ]));
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
            ->when($request->filled('sender_id'), fn ($q) => $q->where('sender_id', $request->query('sender_id')))
            ->when($request->filled('receiver_id'), fn ($q) => $q->where('receiver_id', $request->query('receiver_id')))
            ->when($request->filled('location_id'), function ($q) use ($request) {
                $locationId = $request->query('location_id');

                // Either end of the journey touching this location counts.
                $q->where(function ($sub) use ($locationId) {
                    $sub->whereHas('sender', fn ($s) => $s->where('location_id', $locationId))
                        ->orWhereHas('receiver', fn ($s) => $s->where('location_id', $locationId));
                });
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->query('search') . '%';

                $q->where(function ($sub) use ($term) {
                    $sub->where('reference_no', 'like', $term)
                        ->orWhere('bus_number', 'like', $term)
                        ->orWhere('item_description', 'like', $term)
                        ->orWhereHas('sender', fn ($s) => $s->where('name', 'like', $term))
                        ->orWhereHas('receiver', fn ($s) => $s->where('name', 'like', $term));
                });
            });
    }
}
