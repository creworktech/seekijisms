<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\DispatchEvent;
use App\Models\DispatchPhoto;
use App\Services\DispatchPhotoService;
use App\Services\DispatchService;
use Illuminate\Support\Facades\Event;
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

    // Cleanup when the database transaction that stored a photo rolls back.
    //
    // Photo upload happens inside DB::transaction(), and DB::transaction()
    // has no way to undo an upload that already landed on disk. If something
    // later in that same transaction throws, the row disappears but the file
    // would stay behind — unless the service explicitly cleans it up.

    public function test_a_rolled_back_creation_deletes_the_photo_it_had_already_uploaded(): void
    {
        Storage::fake('local');

        // Fires from inside the transaction, after photos->storeMany() has
        // already written files to disk but before the transaction commits
        // — exactly the ordering the fix targets.
        Event::listen('eloquent.creating: ' . DispatchEvent::class, function () {
            throw new \RuntimeException('Simulated failure after photo upload, before commit.');
        });

        try {
            app(DispatchService::class)->create(
                $this->validDispatchPayload(),
                $this->gumlaUser,
            );
            $this->fail('Expected the simulated exception to propagate.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Simulated failure after photo upload, before commit.', $e->getMessage());
        }

        // The transaction rolled back, so there is no dispatch and no
        // DispatchPhoto row — but that alone wouldn't prove anything about
        // the file. The real assertion is that storage is empty too.
        $this->assertSame(0, Dispatch::count());
        $this->assertSame(0, DispatchPhoto::count());
        $this->assertEmpty(Storage::disk('local')->allFiles('dispatches'), 'An orphaned file was left on disk after the rollback.');
    }

    public function test_a_rolled_back_edit_deletes_only_the_newly_added_photo(): void
    {
        Storage::fake('local');

        $dispatch = Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        $originalPhoto = DispatchPhoto::create([
            'dispatch_id' => $dispatch->id,
            'type' => DispatchPhoto::TYPE_BUS,
            'path' => "dispatches/{$dispatch->id}/bus_preexisting.jpg",
        ]);
        Storage::disk('local')->put($originalPhoto->path, 'existing bus photo');

        Event::listen('eloquent.creating: ' . DispatchEvent::class, function () {
            throw new \RuntimeException('Simulated failure after photo upload, before commit.');
        });

        try {
            app(DispatchService::class)->update($dispatch, $this->gumlaUser, [
                'receiver_id' => $dispatch->receiver_id,
                'from_stop_id' => $dispatch->from_stop_id,
                'to_stop_id' => $dispatch->to_stop_id,
                'item_description' => 'Edited during a failing transaction',
                'quantity' => 2,
                'bus_number' => 'JH01ZZ0000',
                'bus_reach_time' => '10:00',
                'bus_leave_time' => '16:00',
                'bus_photos' => [$this->photo('new-bus.jpg')],
            ]);
            $this->fail('Expected the simulated exception to propagate.');
        } catch (\RuntimeException) {
            // expected
        }

        // The pre-existing photo is untouched...
        Storage::disk('local')->assertExists($originalPhoto->path);
        $this->assertSame(1, DispatchPhoto::count());

        // ...but the one added during the failed edit did not survive as an
        // orphan.
        $this->assertCount(1, Storage::disk('local')->allFiles("dispatches/{$dispatch->id}"));
    }

    public function test_a_rolled_back_receipt_confirmation_deletes_the_receipt_photo(): void
    {
        Storage::fake('local');

        $dispatch = Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();

        Event::listen('eloquent.creating: ' . DispatchEvent::class, function () {
            throw new \RuntimeException('Simulated failure after photo upload, before commit.');
        });

        try {
            app(DispatchService::class)->markReceived($dispatch, $this->hubUser, [
                'receipt_photo' => $this->photo('receipt.jpg'),
            ]);
            $this->fail('Expected the simulated exception to propagate.');
        } catch (\RuntimeException) {
            // expected
        }

        $this->assertSame('pending', $dispatch->fresh()->status->value);
        $this->assertSame(0, DispatchPhoto::count());
        $this->assertEmpty(Storage::disk('local')->allFiles("dispatches/{$dispatch->id}"));
    }
}
