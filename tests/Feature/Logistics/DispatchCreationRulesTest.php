<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\LogisticsUser;
use App\Models\Stop;

/**
 * Business rules 2 to 5 and 12: who may receive, which stops are legal, and
 * the per-type photo ceiling. All enforced server side.
 */
class DispatchCreationRulesTest extends LogisticsTestCase
{
    // Rule 2 — a spoke user may only send to the central hub.

    public function test_a_spoke_user_may_send_to_a_central_user(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();
    }

    public function test_a_spoke_user_cannot_send_to_another_spoke_user(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'receiver_id' => $this->lohardagaUser->id,
                'to_stop_id' => $this->lohardagaStand->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('receiver_id');

        $this->assertSame(0, Dispatch::count(), 'Spokes never send to each other.');
    }

    // Rule 3 — a central user may only send to a non-central active user.

    public function test_a_central_user_may_send_to_a_spoke_user(): void
    {
        $this->actingAs($this->hubUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'receiver_id' => $this->gumlaUser->id,
                'from_stop_id' => $this->khadgarha->id,
                'to_stop_id' => $this->gumlaStand->id,
            ]))
            ->assertCreated();
    }

    public function test_a_central_user_cannot_send_to_another_central_user(): void
    {
        $this->actingAs($this->hubUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'receiver_id' => $this->hubColleague->id,
                'from_stop_id' => $this->khadgarha->id,
                'to_stop_id' => $this->itiStand->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('receiver_id');
    }

    public function test_a_deactivated_user_cannot_be_chosen_as_receiver(): void
    {
        $this->hubUser->update(['is_active' => false]);

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('receiver_id');
    }

    // Rule 4 — from_stop must belong to the sender's location.

    public function test_from_stop_must_belong_to_the_senders_location(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                // A Ranchi stop, but the sender is in Gumla.
                'from_stop_id' => $this->khadgarha->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('from_stop_id');
    }

    // Rule 5 — to_stop must belong to the receiver's location.

    public function test_to_stop_must_belong_to_the_receivers_location(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                // A Gumla stop, but the receiver is in Ranchi.
                'to_stop_id' => $this->gumlaStand->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('to_stop_id');
    }

    public function test_a_stop_from_an_unrelated_location_is_rejected_at_both_ends(): void
    {
        $strayStop = Stop::factory()->create(['location_id' => $this->lohardaga->id]);

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'from_stop_id' => $strayStop->id,
                'to_stop_id' => $strayStop->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['from_stop_id', 'to_stop_id']);
    }

    // Rule 12 — max 2 bus and 2 package photos per dispatch.

    public function test_more_than_two_photos_of_a_type_are_rejected(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_photos' => [$this->photo('a.jpg'), $this->photo('b.jpg'), $this->photo('c.jpg')],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('bus_photos');
    }

    public function test_exactly_two_photos_of_each_type_are_accepted(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_photos' => [$this->photo('a.jpg'), $this->photo('b.jpg')],
                'package_photos' => [$this->photo('c.jpg'), $this->photo('d.jpg')],
            ]))
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        $this->assertSame(2, $dispatch->photos()->where('type', 'bus')->count());
        $this->assertSame(2, $dispatch->photos()->where('type', 'package')->count());
    }

    public function test_at_least_one_photo_of_each_type_is_required(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_photos' => [],
                'package_photos' => [],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['bus_photos', 'package_photos']);
    }

    public function test_an_oversized_photo_is_rejected(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                // The mobile app compresses to roughly 500KB; 3MB is over the limit.
                'bus_photos' => [$this->photo('huge.jpg', 3072)],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('bus_photos.0');
    }

    // Field-level validation

    public function test_required_fields_are_validated(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->postJson($this->apiUrl('dispatches'), [])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'receiver_id', 'from_stop_id', 'to_stop_id',
                'quantity', 'driver_mobile', 'bus_reach_time',
                'bus_photos', 'package_photos',
            ]);
    }

    public function test_quantity_must_be_at_least_one(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['quantity' => 0]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('quantity');
    }

    public function test_mobile_numbers_must_be_ten_digits(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'driver_mobile' => '12345',
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('driver_mobile');
    }

    public function test_times_must_use_24_hour_format(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_reach_time' => '10:00 AM',
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('bus_reach_time');
    }

    public function test_the_dispatch_date_is_set_automatically(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated()
            ->assertJsonPath('data.dispatch_date', now()->toDateString());
    }

    public function test_a_user_outside_the_hub_and_spoke_network_still_obeys_the_rules(): void
    {
        // A second spoke user in Gumla sending to the hub is perfectly legal.
        $colleague = LogisticsUser::factory()->create([
            'location_id' => $this->gumla->id,
            'default_stop_id' => $this->gumlaStand->id,
        ]);

        $this->actingAs($colleague, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();
    }
}
