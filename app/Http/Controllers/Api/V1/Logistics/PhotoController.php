<?php

namespace App\Http\Controllers\Api\V1\Logistics;

use App\Http\Controllers\Controller;
use App\Models\DispatchPhoto;
use App\Models\LogisticsUser;
use App\Models\User;
use App\Services\DispatchPhotoService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Photos are stored outside the public directory, so this is the only way to
 * read one. Access is limited to the sender, anyone at the receiving
 * location, and admins.
 */
class PhotoController extends Controller
{
    public function show(Request $request, DispatchPhoto $photo): StreamedResponse|RedirectResponse
    {
        $photo->loadMissing('dispatch.receiver');

        $this->authorizeAccess($request->user(), $photo);

        $path = $request->query('variant') === 'thumb'
            ? ($photo->thumb_path ?: $photo->path)
            : $photo->path;

        $disk = DispatchPhotoService::disk();

        if (! $disk->exists($path)) {
            throw new NotFoundHttpException('Photo not found.');
        }

        // On object storage, hand the client a short-lived signed link and let
        // it fetch directly rather than relaying the bytes through PHP.
        if (DispatchPhotoService::supportsPresignedUrls()) {
            return redirect()->away(
                $disk->temporaryUrl($path, now()->addMinutes((int) config('logistics.photo_url_ttl', 30)))
            );
        }

        return $disk->response(
            $path,
            basename($path),
            ['Cache-Control' => 'private, max-age=86400']
        );
    }

    private function authorizeAccess(mixed $user, DispatchPhoto $photo): void
    {
        // Web admins of the Service Management System reach photos through the
        // Inertia panel using the session guard.
        if ($user instanceof User) {
            if ($user->can('users.manage')) {
                return;
            }

            throw new AccessDeniedHttpException('You do not have access to this photo.');
        }

        if (! $user instanceof LogisticsUser) {
            throw new AccessDeniedHttpException('You do not have access to this photo.');
        }

        $dispatch = $photo->dispatch;

        if (! $dispatch) {
            throw new NotFoundHttpException('Photo not found.');
        }

        if ($dispatch->sender_id === $user->id) {
            return;
        }

        if ($dispatch->receiver && $dispatch->receiver->location_id === $user->location_id) {
            return;
        }

        throw new AccessDeniedHttpException('You do not have access to this photo.');
    }
}
