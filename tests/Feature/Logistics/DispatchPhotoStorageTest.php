<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\DispatchPhoto;
use App\Services\DispatchPhotoService;
use Illuminate\Support\Facades\Storage;

/**
 * Photos must work identically whichever private disk is configured, and must
 * never become publicly reachable.
 */
class DispatchPhotoStorageTest extends LogisticsTestCase
{
    private function createDispatchWithPhoto(): DispatchPhoto
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();

        $this->forgetResolvedGuards();

        return Dispatch::firstOrFail()->photos()->firstOrFail();
    }

    public function test_photos_land_on_the_configured_disk(): void
    {
        Storage::fake('r2');
        config(['logistics.photo_disk' => 'r2']);

        $photo = $this->createDispatchWithPhoto();

        Storage::disk('r2')->assertExists($photo->path);
        // And not on the server's own storage.
        Storage::disk('local')->assertMissing($photo->path);
    }

    public function test_the_local_disk_streams_rather_than_redirecting(): void
    {
        // A signed local URL would let anyone holding the link bypass the
        // sender/receiver/admin check, so local storage must not presign.
        config(['logistics.photo_disk' => 'local']);

        $this->assertFalse(DispatchPhotoService::supportsPresignedUrls());

        $photo = $this->createDispatchWithPhoto();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertOk();
    }

    public function test_an_s3_style_disk_presigns(): void
    {
        config(['logistics.photo_disk' => 'r2']);

        $this->assertTrue(DispatchPhotoService::supportsPresignedUrls());
    }

    public function test_authorisation_still_applies_before_any_link_is_issued(): void
    {
        Storage::fake('r2');
        config(['logistics.photo_disk' => 'r2']);

        $photo = $this->createDispatchWithPhoto();

        // Storing in the cloud must not weaken who may ask for a photo.
        $this->get($this->apiUrl("photos/{$photo->id}"))->assertUnauthorized();

        $this->forgetResolvedGuards();

        $this->actingAs($this->lohardagaUser, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertForbidden();
    }

    public function test_a_missing_object_is_not_reported_as_available(): void
    {
        Storage::fake('r2');
        config(['logistics.photo_disk' => 'r2']);

        $photo = $this->createDispatchWithPhoto();
        Storage::disk('r2')->delete($photo->path);

        $this->actingAs($this->gumlaUser, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertNotFound();
    }

    public function test_photos_are_never_written_to_the_public_disk(): void
    {
        Storage::fake('public');

        $photo = $this->createDispatchWithPhoto();

        Storage::disk('public')->assertMissing($photo->path);
        $this->assertStringNotContainsString('public', $photo->path);
    }
}
