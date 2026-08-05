<?php

namespace App\Http\Resources\Logistics;

use App\Models\DispatchPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DispatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_no' => $this->reference_no,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),

            // resolve() on every nested resource is deliberate. JsonResource
            // implements Responsable, and Inertia turns a Responsable prop
            // into toResponse()->getData(), which wraps it in "data" — the
            // page would then read sender.data.name instead of sender.name.
            'sender' => $this->whenLoaded('sender', fn () => (new LogisticsUserResource($this->sender))->resolve()),
            'receiver' => $this->whenLoaded('receiver', fn () => (new LogisticsUserResource($this->receiver))->resolve()),
            'received_by' => $this->whenLoaded('receivedBy', fn () => (new LogisticsUserResource($this->receivedBy))->resolve()),

            'from_stop' => $this->whenLoaded('fromStop', fn () => (new StopResource($this->fromStop))->resolve()),
            'to_stop' => $this->whenLoaded('toStop', fn () => (new StopResource($this->toStop))->resolve()),
            'route' => $this->whenLoaded('fromStop', fn () => sprintf(
                '%s → %s',
                $this->fromStop?->name ?? '?',
                $this->relationLoaded('toStop') ? ($this->toStop?->name ?? '?') : '?'
            )),

            'item_description' => $this->item_description,
            'quantity' => $this->quantity,
            'bus_number' => $this->bus_number,
            'driver_mobile' => $this->driver_mobile,
            'receiver_mobile' => $this->receiver_mobile,
            'bus_reach_time' => $this->formatTime($this->bus_reach_time),
            'bus_leave_time' => $this->formatTime($this->bus_leave_time),
            'remarks' => $this->remarks,

            'dispatch_date' => $this->dispatch_date?->toDateString(),
            'received_at' => $this->received_at?->toIso8601String(),
            'receipt_note' => $this->receipt_note,
            'receipt_latitude' => $this->receipt_latitude,
            'receipt_longitude' => $this->receipt_longitude,

            // resolve() on the nested collections is deliberate. Without it a
            // resource collection keeps its own "data" wrapper once the parent
            // is resolved for Inertia, so the page would receive
            // {"data": [...]} where the component expects a plain array.
            'photos' => $this->whenLoaded('photos', fn () => [
                'bus' => DispatchPhotoResource::collection($this->photos->where('type', DispatchPhoto::TYPE_BUS)->values())->resolve(),
                'package' => DispatchPhotoResource::collection($this->photos->where('type', DispatchPhoto::TYPE_PACKAGE)->values())->resolve(),
                'receipt' => DispatchPhotoResource::collection($this->photos->where('type', DispatchPhoto::TYPE_RECEIPT)->values())->resolve(),
            ]),

            'events' => $this->whenLoaded('events', fn () => DispatchEventResource::collection($this->events)->resolve()),

            'can_edit' => $this->when(
                $request->user() !== null,
                fn () => $request->user() instanceof \App\Models\LogisticsUser
                    && $this->isEditableBy($request->user())
            ),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function formatTime(mixed $time): ?string
    {
        if (! $time) {
            return null;
        }

        // Times come back from MySQL as H:i:s; the apps want H:i.
        return substr((string) $time, 0, 5);
    }
}
