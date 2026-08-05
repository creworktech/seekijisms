<?php

namespace App\Http\Resources\Logistics;

use App\Services\DispatchPhotoService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Log;

class DispatchPhotoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'url' => $this->link($this->path),
            'thumb_url' => $this->link($this->thumb_path ?: $this->path, 'thumb'),
        ];
    }

    /**
     * A presigned link straight to object storage where the disk supports it,
     * otherwise our own authenticated streaming route.
     *
     * Photos are private either way. This resource is only ever serialised
     * after the caller has been authorised to see the dispatch, so handing
     * back a short-lived signed URL exposes nothing extra — and it saves
     * relaying every image through the application server.
     */
    private function link(?string $path, ?string $variant = null): ?string
    {
        if (! $path) {
            return null;
        }

        try {
            if (DispatchPhotoService::supportsPresignedUrls()) {
                return DispatchPhotoService::disk()->temporaryUrl(
                    $path,
                    now()->addMinutes((int) config('logistics.photo_url_ttl', 30)),
                );
            }
        } catch (\Throwable $e) {
            // Misconfigured bucket or an offline provider must not blank out
            // the whole dispatch payload; fall through to the local route.
            Log::warning('Could not sign a photo URL, falling back to streaming', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
        }

        return route('logistics.photos.show', array_filter([
            'photo' => $this->id,
            'variant' => $variant,
        ]));
    }
}
