<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LogisticsUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'mobile' => $this->mobile,
            'location_id' => $this->location_id,
            // resolve() keeps these plain arrays rather than {"data": {...}}
            // once Inertia serialises the parent prop.
            'location' => $this->whenLoaded('location', fn () => (new LocationResource($this->location))->resolve()),
            'location_name' => $this->whenLoaded('location', fn () => $this->location?->name),
            'default_stop_id' => $this->default_stop_id,
            'default_stop' => $this->whenLoaded('defaultStop', fn () => (new StopResource($this->defaultStop))->resolve()),
            'is_central' => (bool) $this->is_central,
            'is_active' => (bool) $this->is_active,
            'role' => $this->is_central ? 'central' : 'spoke',
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
