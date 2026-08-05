<?php

namespace App\Services;

use App\Models\Dispatch;
use App\Models\DispatchPhoto;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores dispatch photographs on a private disk — the server's own storage in
 * development, Cloudflare R2 in production. Nothing is ever public: photos are
 * reached either through an authenticated route or a short-lived presigned URL.
 */
class DispatchPhotoService
{
    private const THUMB_WIDTH = 400;

    public static function disk(): Filesystem
    {
        return Storage::disk(config('logistics.photo_disk'));
    }

    /**
     * Whether photos should be handed out as presigned links.
     *
     * Deliberately keyed off the driver rather than method_exists(): every
     * FilesystemAdapter exposes temporaryUrl(), and the local driver will
     * happily sign one when 'serve' is enabled. A signed local URL would let
     * anyone holding the link bypass the sender/receiver/admin check, so on
     * local storage we keep streaming through the authenticated route.
     */
    public static function supportsPresignedUrls(): bool
    {
        return config('filesystems.disks.' . config('logistics.photo_disk') . '.driver') === 's3';
    }

    /**
     * @param  UploadedFile[]  $files
     * @return DispatchPhoto[]
     */
    public function storeMany(Dispatch $dispatch, array $files, string $type): array
    {
        $stored = [];

        foreach ($files as $file) {
            if ($file instanceof UploadedFile) {
                $stored[] = $this->store($dispatch, $file, $type);
            }
        }

        return $stored;
    }

    public function store(Dispatch $dispatch, UploadedFile $file, string $type): DispatchPhoto
    {
        $directory = "dispatches/{$dispatch->id}";
        $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $filename = $type . '_' . Str::random(16) . '.' . $extension;

        $path = $file->storeAs($directory, $filename, config('logistics.photo_disk'));

        return DispatchPhoto::create([
            'dispatch_id' => $dispatch->id,
            'type' => $type,
            'path' => $path,
            'thumb_path' => $this->makeThumbnail($file, $directory, $filename),
        ]);
    }

    /**
     * How many more photos of this type the dispatch will accept.
     */
    public function remainingSlots(Dispatch $dispatch, string $type): int
    {
        $limit = DispatchPhoto::MAX_PER_TYPE[$type] ?? 0;
        $used = $dispatch->photos()->where('type', $type)->count();

        return max(0, $limit - $used);
    }

    public function hasCapacityFor(Dispatch $dispatch, string $type, int $incoming): bool
    {
        return $incoming <= $this->remainingSlots($dispatch, $type);
    }

    /**
     * Generates a 400px-wide thumbnail for list and carousel screens.
     *
     * Reads from the uploaded temp file and writes bytes back through the
     * disk, rather than touching an absolute path — object storage has no
     * local path to hand to GD.
     *
     * Returns null when no imaging extension is loaded, in which case the API
     * falls back to the full-size image. A thumbnail is a convenience, never a
     * reason to lose an upload.
     */
    private function makeThumbnail(UploadedFile $file, string $directory, string $filename): ?string
    {
        if (! function_exists('imagecreatetruecolor')) {
            return null;
        }

        try {
            $source = $file->getRealPath();
            $info = $source ? @getimagesize($source) : false;

            if (! $info) {
                return null;
            }

            [$width, $height] = $info;

            $image = match ($info[2]) {
                IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
                IMAGETYPE_PNG => @imagecreatefrompng($source),
                default => null,
            };

            if (! $image) {
                return null;
            }

            $targetWidth = min($width, self::THUMB_WIDTH);
            $targetHeight = (int) round($height * ($targetWidth / $width));

            $thumb = imagecreatetruecolor($targetWidth, $targetHeight);
            imagecopyresampled($thumb, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

            // Capture the encoded bytes instead of writing to a local path.
            ob_start();
            imagejpeg($thumb, null, 80);
            $bytes = ob_get_clean();

            imagedestroy($thumb);
            imagedestroy($image);

            if ($bytes === false || $bytes === '') {
                return null;
            }

            $thumbPath = $directory . '/thumb_' . $filename;
            self::disk()->put($thumbPath, $bytes);

            return $thumbPath;
        } catch (\Throwable $e) {
            Log::warning('Dispatch thumbnail generation failed', [
                'file' => $filename,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
