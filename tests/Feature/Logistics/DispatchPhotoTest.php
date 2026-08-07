<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\DispatchPhoto;
use App\Models\LogisticsUser;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Storage;

/**
 * Photos are evidence, so they never sit in the public directory and are
 * only readable by the sender, the receiving location, or an admin.
 */
class DispatchPhotoTest extends LogisticsTestCase
{
    private function dispatchWithPhoto(): array
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        // Creating the fixture authenticated a guard. Clear it so a test
        // asserting "anonymous is refused" is not silently answered by the
        // sender still being resolved in memory.
        $this->forgetResolvedGuards();

        return [$dispatch, $dispatch->photos()->firstOrFail()];
    }

    public function test_photos_are_stored_outside_the_public_directory(): void
    {
        [$dispatch, $photo] = $this->dispatchWithPhoto();

        $this->assertStringStartsWith("dispatches/{$dispatch->id}/", $photo->path);
        $this->assertStringNotContainsString('public', $photo->path);

        Storage::disk('local')->assertExists($photo->path);
    }

    public function test_the_sender_can_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertOk();
    }

    public function test_the_receiver_can_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $this->actingAs($this->hubUser, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertOk();
    }

    public function test_a_colleague_at_the_receiving_location_can_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $this->actingAs($this->hubColleague, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertOk();
    }


    public function test_an_unrelated_user_cannot_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $outsider = LogisticsUser::factory()->create(['location_id' => $this->lohardaga->id]);

        $this->actingAs($outsider, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertForbidden();
    }

    public function test_an_anonymous_request_cannot_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $this->get($this->apiUrl("photos/{$photo->id}"))->assertUnauthorized();
    }

    public function test_a_service_management_web_admin_can_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $this->seed(RolesAndPermissionsSeeder::class);
        $webAdmin = User::factory()->create(['is_active' => true]);
        $webAdmin->assignRole('admin');

        $this->actingAs($webAdmin, 'web')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertOk();
    }

    public function test_a_service_management_user_without_permission_cannot_view_a_photo(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        $this->seed(RolesAndPermissionsSeeder::class);
        $tester = User::factory()->create(['is_active' => true]);
        $tester->assignRole('tester');

        $this->actingAs($tester, 'web')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertForbidden();
    }

    public function test_photos_are_grouped_by_type_in_the_detail_payload(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_photos' => [$this->photo('bus1.jpg'), $this->photo('bus2.jpg')],
                'package_photos' => [$this->photo('pkg.jpg')],
            ]))
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->getJson($this->apiUrl("dispatches/{$dispatch->id}"))
            ->assertOk()
            ->assertJsonCount(2, 'data.photos.bus')
            ->assertJsonCount(1, 'data.photos.package')
            ->assertJsonCount(0, 'data.photos.receipt');
    }

    public function test_a_receipt_photo_is_attached_on_confirmation(): void
    {
        [$dispatch] = $this->dispatchWithPhoto();

        $this->actingAs($this->hubUser, 'logistics')
            ->post($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'received',
                'receipt_photo' => $this->photo('receipt.jpg'),
            ])
            ->assertOk();

        $this->assertSame(1, $dispatch->photos()->where('type', DispatchPhoto::TYPE_RECEIPT)->count());
    }

    public function test_editing_cannot_push_a_dispatch_past_the_photo_ceiling(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_photos' => [$this->photo('bus1.jpg'), $this->photo('bus2.jpg')],
            ]))
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        // Already at 2 bus photos; adding another must be refused.
        $this->actingAs($this->gumlaUser, 'logistics')
            ->put($this->apiUrl("dispatches/{$dispatch->id}"), [
                'receiver_id' => $this->hubUser->id,
                'from_stop_id' => $this->gumlaStand->id,
                'to_stop_id' => $this->khadgarha->id,
                'quantity' => 1,
                'driver_mobile' => '9876543210',
                'bus_reach_time' => '10:00',
                'bus_photos' => [$this->photo('bus3.jpg')],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('bus_photos');

        $this->assertSame(2, $dispatch->photos()->where('type', DispatchPhoto::TYPE_BUS)->count());
    }

    public function test_a_missing_photo_file_returns_404(): void
    {
        [, $photo] = $this->dispatchWithPhoto();

        Storage::disk('local')->delete($photo->path);

        $this->actingAs($this->gumlaUser, 'logistics')
            ->get($this->apiUrl("photos/{$photo->id}"))
            ->assertNotFound();
    }
}
