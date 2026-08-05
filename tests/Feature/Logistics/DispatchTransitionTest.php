<?php

namespace Tests\Feature\Logistics;

use App\Enums\DispatchStatus;
use App\Models\Dispatch;
use App\Models\DispatchEvent;
use App\Models\LogisticsUser;

/**
 * Business rules 6, 7 and 8: only the receiving side changes status, status
 * only leaves pending once (except not_received to received), and edits are
 * limited to the sender while pending.
 */
class DispatchTransitionTest extends LogisticsTestCase
{
    private function pendingDispatch(): Dispatch
    {
        return Dispatch::factory()
            ->between($this->gumlaUser, $this->hubUser)
            ->create();
    }

    // Rule 6 — the sender can never change status.

    public function test_the_sender_cannot_mark_their_own_dispatch_received(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertForbidden();

        $this->assertSame(DispatchStatus::PENDING, $dispatch->fresh()->status);
    }

    public function test_the_sender_cannot_mark_their_own_dispatch_not_received(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Trying to cancel my own dispatch.',
            ])
            ->assertForbidden();

        $this->assertSame(DispatchStatus::PENDING, $dispatch->fresh()->status);
    }

    public function test_an_unrelated_user_cannot_change_status(): void
    {
        $dispatch = $this->pendingDispatch();

        // Lohardaga has nothing to do with a Gumla-to-Ranchi dispatch.
        $this->actingAs($this->lohardagaUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertForbidden();
    }

    // The receiver, and colleagues at that location, can.

    public function test_the_receiver_can_mark_a_dispatch_received(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'received',
                'latitude' => 23.3441,
                'longitude' => 85.3096,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'received');

        $dispatch->refresh();

        $this->assertSame($this->hubUser->id, $dispatch->received_by);
        $this->assertNotNull($dispatch->received_at);
        $this->assertEquals(23.3441, (float) $dispatch->receipt_latitude);
    }

    public function test_another_active_user_at_the_receiving_location_can_also_mark_received(): void
    {
        $dispatch = $this->pendingDispatch();

        // The first to confirm wins, and the acting user is logged.
        $this->actingAs($this->hubColleague, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertOk();

        $this->assertSame($this->hubColleague->id, $dispatch->fresh()->received_by);
    }

    public function test_a_deactivated_colleague_cannot_mark_received(): void
    {
        $dispatch = $this->pendingDispatch();
        $this->hubColleague->update(['is_active' => false]);

        $this->actingAs($this->hubColleague, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertForbidden();
    }

    // Rule 7 — status only changes from pending.

    public function test_marking_an_already_received_dispatch_returns_409(): void
    {
        $dispatch = Dispatch::factory()
            ->between($this->gumlaUser, $this->hubUser)
            ->received($this->hubUser)
            ->create();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertStatus(409);
    }

    public function test_a_received_dispatch_cannot_become_not_received(): void
    {
        $dispatch = Dispatch::factory()
            ->between($this->gumlaUser, $this->hubUser)
            ->received($this->hubUser)
            ->create();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Changed my mind about this one.',
            ])
            ->assertStatus(409);

        $this->assertSame(DispatchStatus::RECEIVED, $dispatch->fresh()->status);
    }

    public function test_a_not_received_dispatch_can_later_be_marked_received(): void
    {
        $dispatch = Dispatch::factory()
            ->between($this->gumlaUser, $this->hubUser)
            ->notReceived()
            ->create();

        // The package turned up after all.
        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertOk()
            ->assertJsonPath('data.status', 'received');

        $this->assertSame(DispatchStatus::RECEIVED, $dispatch->fresh()->status);
    }

    public function test_a_not_received_dispatch_cannot_be_marked_not_received_again(): void
    {
        $dispatch = Dispatch::factory()
            ->between($this->gumlaUser, $this->hubUser)
            ->notReceived()
            ->create();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Still has not turned up.',
            ])
            ->assertStatus(409);
    }

    // not_received requires a reason.

    public function test_not_received_without_a_note_returns_422(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'not_received'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('note');

        $this->assertSame(DispatchStatus::PENDING, $dispatch->fresh()->status);
    }

    public function test_not_received_with_too_short_a_note_returns_422(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'no',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('note');
    }

    public function test_an_unknown_action_is_rejected(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'lost'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('action');
    }

    // Audit log — exactly one row per transition, with the right actor.

    public function test_each_transition_writes_exactly_one_event_with_the_acting_user(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->assertSame(0, DispatchEvent::where('dispatch_id', $dispatch->id)->count());

        $this->actingAs($this->hubColleague, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Bus arrived without the parcel.',
            ])->assertOk();

        $events = DispatchEvent::where('dispatch_id', $dispatch->id)->get();
        $this->assertCount(1, $events);
        $this->assertSame($this->hubColleague->id, $events->first()->user_id);
        $this->assertSame('pending', $events->first()->from_status);
        $this->assertSame('not_received', $events->first()->to_status);

        // Resolving it later adds exactly one more row, attributed correctly.
        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertOk();

        $events = DispatchEvent::where('dispatch_id', $dispatch->id)->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertSame($this->hubUser->id, $events->last()->user_id);
        $this->assertSame('not_received', $events->last()->from_status);
        $this->assertSame('received', $events->last()->to_status);
    }

    public function test_a_failed_transition_writes_no_event(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), ['action' => 'received'])
            ->assertForbidden();

        $this->assertSame(0, DispatchEvent::where('dispatch_id', $dispatch->id)->count());
    }

    // Rule 8 — editable only while pending, and only by the sender.

    public function test_the_sender_can_edit_a_pending_dispatch(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->putJson($this->apiUrl("dispatches/{$dispatch->id}"), [
                'receiver_id' => $this->hubUser->id,
                'from_stop_id' => $dispatch->from_stop_id,
                'to_stop_id' => $dispatch->to_stop_id,
                'item_description' => 'Corrected item description',
                'quantity' => 5,
                'bus_number' => 'jh01zz9999',
                'bus_reach_time' => '11:30',
                'bus_leave_time' => '17:45',
            ])
            ->assertOk()
            ->assertJsonPath('data.item_description', 'Corrected item description')
            ->assertJsonPath('data.quantity', 5)
            ->assertJsonPath('data.bus_number', 'JH01ZZ9999');
    }

    public function test_a_non_sender_cannot_edit_a_dispatch(): void
    {
        $dispatch = $this->pendingDispatch();

        // Ownership is rejected before the payload is validated, so this is a
        // flat 403 rather than a 422 about the receiver's own stops.
        $this->actingAs($this->hubUser, 'logistics')
            ->putJson($this->apiUrl("dispatches/{$dispatch->id}"), [
                'receiver_id' => $this->hubUser->id,
                'from_stop_id' => $dispatch->from_stop_id,
                'to_stop_id' => $dispatch->to_stop_id,
                'item_description' => 'Receiver trying to edit',
                'quantity' => 1,
                'bus_number' => 'JH01AA0000',
                'bus_reach_time' => '10:00',
                'bus_leave_time' => '16:00',
            ])
            ->assertForbidden();

        $this->assertNotSame('Receiver trying to edit', $dispatch->fresh()->item_description);
    }

    public function test_a_confirmed_dispatch_can_no_longer_be_edited(): void
    {
        $dispatch = Dispatch::factory()
            ->between($this->gumlaUser, $this->hubUser)
            ->received($this->hubUser)
            ->create();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->putJson($this->apiUrl("dispatches/{$dispatch->id}"), [
                'receiver_id' => $this->hubUser->id,
                'from_stop_id' => $dispatch->from_stop_id,
                'to_stop_id' => $dispatch->to_stop_id,
                'item_description' => 'Too late to change this',
                'quantity' => 1,
                'bus_number' => 'JH01AA0000',
                'bus_reach_time' => '10:00',
                'bus_leave_time' => '16:00',
            ])
            ->assertStatus(409);
    }

    public function test_can_edit_flag_reflects_who_is_asking(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->getJson($this->apiUrl("dispatches/{$dispatch->id}"))
            ->assertOk()
            ->assertJsonPath('data.can_edit', true);

        $this->actingAs($this->hubUser, 'logistics')
            ->getJson($this->apiUrl("dispatches/{$dispatch->id}"))
            ->assertOk()
            ->assertJsonPath('data.can_edit', false);
    }

    // Listing scopes

    public function test_the_received_list_is_scoped_to_the_users_location(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->lohardagaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->hubUser, $this->gumlaUser)->create();

        // A Ranchi colleague sees both inbound dispatches, not the outbound one.
        $this->actingAs($this->hubColleague, 'logistics')
            ->getJson($this->apiUrl('dispatches/received'))
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // The Gumla user sees only the one addressed to Gumla.
        $this->actingAs($this->gumlaUser, 'logistics')
            ->getJson($this->apiUrl('dispatches/received'))
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_the_sent_list_returns_only_the_callers_own_dispatches(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->lohardagaUser, $this->hubUser)->create();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->getJson($this->apiUrl('dispatches/sent'))
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_lists_filter_by_status(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->received($this->hubUser)->create();
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->notReceived()->create();

        foreach (['pending' => 1, 'received' => 1, 'not_received' => 1] as $status => $expected) {
            $this->actingAs($this->gumlaUser, 'logistics')
                ->getJson($this->apiUrl("dispatches/sent?status={$status}"))
                ->assertOk()
                ->assertJsonCount($expected, 'data');
        }
    }

    public function test_a_stranger_cannot_view_a_dispatch_detail(): void
    {
        $dispatch = $this->pendingDispatch();

        $outsider = LogisticsUser::factory()->create(['location_id' => $this->lohardaga->id]);

        $this->actingAs($outsider, 'logistics')
            ->getJson($this->apiUrl("dispatches/{$dispatch->id}"))
            ->assertForbidden();
    }
}
