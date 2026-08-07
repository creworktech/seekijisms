<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;

/**
 * The admin panel's "create and confirm on behalf of" flow. The admin
 * account is never a LogisticsUser, so every action here names an explicit
 * sender or acting user rather than relying on the authenticated identity —
 * unlike the mobile endpoints in DispatchCreationRulesTest and
 * DispatchTransitionTest, which this deliberately mirrors the business
 * rules of rather than duplicating every case of.
 */
class LogisticsAdminDispatchActionsTest extends LogisticsTestCase
{
    private function validAdminPayload(array $overrides = []): array
    {
        return array_merge([
            'sender_id' => $this->gumlaUser->id,
            'receiver_id' => $this->hubUser->id,
            'from_stop_id' => $this->gumlaStand->id,
            'to_stop_id' => $this->khadgarha->id,
            'quantity' => 2,
            'driver_mobile' => '9876543210',
            'bus_reach_time' => '10:00',
            'bus_photos' => [$this->photo('bus.jpg')],
            'package_photos' => [$this->photo('package.jpg')],
        ], $overrides);
    }

    // Create on behalf of a sender

    public function test_an_admin_can_create_a_dispatch_on_behalf_of_a_sender(): void
    {
        $this->actingAs($this->webAdmin(), 'web')
            ->post('/api/v1/logistics/admin/dispatches', $this->validAdminPayload())
            ->assertCreated()
            ->assertJsonPath('data.sender.id', $this->gumlaUser->id)
            ->assertJsonPath('data.receiver.id', $this->hubUser->id)
            ->assertJsonPath('data.status', 'pending');

        $this->assertSame(1, Dispatch::count());
    }

    public function test_admin_creation_still_enforces_the_hub_and_spoke_rule(): void
    {
        $this->actingAs($this->webAdmin(), 'web')
            ->post('/api/v1/logistics/admin/dispatches', $this->validAdminPayload([
                'sender_id' => $this->gumlaUser->id,
                'receiver_id' => $this->lohardagaUser->id,
                'to_stop_id' => $this->lohardagaStand->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('receiver_id');

        $this->assertSame(0, Dispatch::count(), 'Spokes never send to each other, even via the admin panel.');
    }

    public function test_admin_creation_still_enforces_stop_ownership(): void
    {
        $this->actingAs($this->webAdmin(), 'web')
            ->post('/api/v1/logistics/admin/dispatches', $this->validAdminPayload([
                // A Ranchi stop, but the chosen sender is in Gumla.
                'from_stop_id' => $this->khadgarha->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('from_stop_id');
    }

    public function test_sender_and_receiver_must_differ(): void
    {
        $this->actingAs($this->webAdmin(), 'web')
            ->post('/api/v1/logistics/admin/dispatches', $this->validAdminPayload([
                'receiver_id' => $this->gumlaUser->id,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('receiver_id');
    }

    public function test_a_deactivated_sender_is_rejected(): void
    {
        $this->gumlaUser->update(['is_active' => false]);

        $this->actingAs($this->webAdmin(), 'web')
            ->post('/api/v1/logistics/admin/dispatches', $this->validAdminPayload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('sender_id');
    }

    public function test_a_logistics_account_cannot_create_via_the_admin_endpoint(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post('/api/v1/logistics/admin/dispatches', $this->validAdminPayload())
            ->assertForbidden();
    }

    // Confirm (receive / not received) on behalf of a logistics user

    private function pendingDispatch(): Dispatch
    {
        return Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
    }

    public function test_an_admin_can_mark_a_dispatch_received_on_behalf_of_the_receiver(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->webAdmin(), 'web')
            ->post("/api/v1/logistics/admin/dispatches/{$dispatch->id}/receive", [
                'acting_user_id' => $this->hubUser->id,
                'action' => 'received',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'received');

        $this->assertSame($this->hubUser->id, $dispatch->fresh()->received_by);
    }

    public function test_an_admin_can_mark_a_dispatch_received_via_a_colleague_at_the_same_location(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->webAdmin(), 'web')
            ->post("/api/v1/logistics/admin/dispatches/{$dispatch->id}/receive", [
                'acting_user_id' => $this->hubColleague->id,
                'action' => 'received',
            ])
            ->assertOk();

        $this->assertSame($this->hubColleague->id, $dispatch->fresh()->received_by);
    }

    public function test_not_received_requires_a_note(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->webAdmin(), 'web')
            ->postJson("/api/v1/logistics/admin/dispatches/{$dispatch->id}/receive", [
                'acting_user_id' => $this->hubUser->id,
                'action' => 'not_received',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('note');
    }

    public function test_the_sender_cannot_be_named_as_the_confirming_user(): void
    {
        $dispatch = $this->pendingDispatch();

        // Passes validation (gumlaUser is a real, active logistics user) but
        // fails DispatchService's own rule 6 check, so this is a 403 from the
        // service layer rather than a 422 from the form request.
        $this->actingAs($this->webAdmin(), 'web')
            ->post("/api/v1/logistics/admin/dispatches/{$dispatch->id}/receive", [
                'acting_user_id' => $this->gumlaUser->id,
                'action' => 'received',
            ])
            ->assertStatus(403);

        $this->assertSame('pending', $dispatch->fresh()->status->value);
    }

    public function test_a_user_at_an_unrelated_location_cannot_be_named_as_the_confirming_user(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->webAdmin(), 'web')
            ->post("/api/v1/logistics/admin/dispatches/{$dispatch->id}/receive", [
                'acting_user_id' => $this->lohardagaUser->id,
                'action' => 'received',
            ])
            ->assertStatus(403);
    }

    public function test_a_logistics_account_cannot_confirm_via_the_admin_endpoint(): void
    {
        $dispatch = $this->pendingDispatch();

        $this->actingAs($this->hubUser, 'logistics')
            ->post("/api/v1/logistics/admin/dispatches/{$dispatch->id}/receive", [
                'acting_user_id' => $this->hubUser->id,
                'action' => 'received',
            ])
            ->assertForbidden();
    }
}
