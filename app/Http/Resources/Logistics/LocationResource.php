<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'is_central' => (bool) $this->is_central,
            'is_active' => (bool) $this->is_active,
            // resolve() keeps this a plain array rather than {"data": [...]}
            // once the parent resource is resolved for an Inertia page.
            'stops' => $this->whenLoaded('stops', fn () => StopResource::collection($this->stops)->resolve()),
            'stops_count' => $this->whenCounted('stops'),
            'active_users_count' => $this->whenCounted('activeUsers'),
        ];
    }
}
