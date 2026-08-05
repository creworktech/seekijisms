<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\Location;
use App\Models\LogisticsUser;
use App\Models\Stop;
use Illuminate\Support\Facades\Hash;

/**
 * Admin surface, plus locked decisions 1, 5, 10, 11 and 13:
 * one location per user, every location keeps an active stop, nothing is
 * ever deleted, and a location with active users cannot be switched off.
 */
class LogisticsAdminTest extends LogisticsAdminTestCase
{
    // Users

    public function test_an_admin_can_create_a_user(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'New Gumla Staff',
                'mobile' => '9812345678',
                'password' => 'secret123',
                'location_id' => $this->gumla->id,
                'default_stop_id' => $this->gumlaStand->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'New Gumla Staff')
            ->assertJsonPath('data.role', 'spoke');

        $this->assertDatabaseHas('logistics_users', ['mobile' => '9812345678']);
    }

    // Locked decision 3 — mobile is the login identity, so it must be unique.

    public function test_a_duplicate_mobile_number_is_rejected(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'Impostor',
                'mobile' => $this->gumlaUser->mobile,
                'password' => 'secret123',
                'location_id' => $this->gumla->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('mobile');
    }

    public function test_an_invalid_indian_mobile_number_is_rejected(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'Bad Number',
                // Indian mobiles start 6-9.
                'mobile' => '1234567890',
                'password' => 'secret123',
                'location_id' => $this->gumla->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('mobile');
    }

    // Rule 13 — a location needs an active stop before users can be assigned.

    public function test_a_user_cannot_be_assigned_to_a_location_with_no_active_stop(): void
    {
        $bare = Location::factory()->create(['name' => 'Khunti']);

        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'Khunti Staff',
                'mobile' => '9812345679',
                'password' => 'secret123',
                'location_id' => $bare->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('location_id');
    }

    public function test_a_default_stop_must_belong_to_the_users_own_location(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'Mismatched Stop',
                'mobile' => '9812345680',
                'password' => 'secret123',
                'location_id' => $this->gumla->id,
                // A Ranchi stop for a Gumla user.
                'default_stop_id' => $this->khadgarha->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('default_stop_id');
    }

    public function test_a_hub_user_may_default_to_a_stop_at_any_location(): void
    {
        // Ranchi staff handle traffic to and from every spoke, so their
        // default stop is not confined to Ranchi's own bus stands.
        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'Hub Runner',
                'mobile' => '9812345690',
                'password' => 'secret123',
                'location_id' => $this->ranchi->id,
                'default_stop_id' => $this->gumlaStand->id,
                'is_central' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.default_stop.name', 'Gumla Bus Stand');
    }

    public function test_a_hub_user_can_be_edited_onto_a_foreign_stop(): void
    {
        $this->adminRequest()
            ->putJson($this->adminUrl("users/{$this->hubUser->id}"), [
                'name' => $this->hubUser->name,
                'mobile' => $this->hubUser->mobile,
                'location_id' => $this->ranchi->id,
                'default_stop_id' => $this->lohardagaStand->id,
                'is_central' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.default_stop.name', 'Lohardaga Bus Stand');
    }

    public function test_a_central_flag_requires_the_central_location(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('users'), [
                'name' => 'Fake Central',
                'mobile' => '9812345681',
                'password' => 'secret123',
                'location_id' => $this->gumla->id,
                'is_central' => true,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('is_central');
    }

    public function test_an_admin_chooses_the_new_password(): void
    {
        $original = $this->gumlaUser->password;

        $this->adminRequest()
            ->postJson($this->adminUrl("users/{$this->gumlaUser->id}/reset-password"), [
                'password' => 'gumla2026',
            ])
            ->assertOk()
            // The admin typed it, so it is never echoed back.
            ->assertJsonMissingPath('data.password');

        $fresh = $this->gumlaUser->fresh();

        $this->assertNotSame($original, $fresh->password);
        $this->assertTrue(Hash::check('gumla2026', $fresh->password));
    }

    public function test_the_new_password_can_actually_be_used_to_log_in(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl("users/{$this->gumlaUser->id}/reset-password"), [
                'password' => 'gumla2026',
            ])
            ->assertOk();

        $this->forgetResolvedGuards();

        $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'gumla2026',
        ])->assertOk();
    }

    public function test_a_password_reset_requires_a_password_of_at_least_six_characters(): void
    {
        foreach ([null, '', 'abc'] as $candidate) {
            $this->adminRequest()
                ->postJson(
                    $this->adminUrl("users/{$this->gumlaUser->id}/reset-password"),
                    $candidate === null ? [] : ['password' => $candidate]
                )
                ->assertStatus(422)
                ->assertJsonValidationErrors('password');
        }

        // Unchanged: the original password still works.
        $this->assertTrue(Hash::check('secret', $this->gumlaUser->fresh()->password));
    }

    public function test_a_password_reset_signs_the_user_out_everywhere(): void
    {
        $token = $this->gumlaUser->createToken('phone')->plainTextToken;

        $this->adminRequest()
            ->postJson($this->adminUrl("users/{$this->gumlaUser->id}/reset-password"), [
                'password' => 'gumla2026',
            ])
            ->assertOk();

        $this->forgetResolvedGuards();

        $this->withToken($token)->getJson($this->apiUrl('auth/me'))->assertUnauthorized();
    }

    public function test_toggling_a_user_off_and_on_works(): void
    {
        $this->adminRequest()
            ->patchJson($this->adminUrl("users/{$this->gumlaUser->id}/toggle-status"))
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->adminRequest()
            ->patchJson($this->adminUrl("users/{$this->gumlaUser->id}/toggle-status"))
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_users_can_be_filtered_by_location_and_role(): void
    {
        $this->adminRequest()
            ->getJson($this->adminUrl('users?location_id=' . $this->gumla->id))
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->adminRequest()
            ->getJson($this->adminUrl('users?role=central'))
            ->assertOk()
            // hubUser and hubColleague — the two staff at the Ranchi hub.
            ->assertJsonCount(2, 'data');
    }

    // Locations

    public function test_an_admin_can_create_a_location(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('locations'), ['name' => 'Khunti'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Khunti');
    }

    public function test_only_one_location_may_be_central(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('locations'), ['name' => 'Second Hub', 'is_central' => true])
            ->assertStatus(422)
            ->assertJsonValidationErrors('is_central');
    }

    public function test_duplicate_location_names_are_rejected(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('locations'), ['name' => 'Gumla'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    // Rule 11 — a location with active users cannot be deactivated.

    public function test_a_location_with_active_users_cannot_be_deactivated(): void
    {
        $this->adminRequest()
            ->patchJson($this->adminUrl("locations/{$this->gumla->id}/toggle-status"))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Gumla still has 1 active user(s). Deactivate or move them before deactivating this location.']);

        $this->assertTrue($this->gumla->fresh()->is_active);
    }

    public function test_a_location_can_be_deactivated_once_its_users_are_off(): void
    {
        $this->gumlaUser->update(['is_active' => false]);

        $this->adminRequest()
            ->patchJson($this->adminUrl("locations/{$this->gumla->id}/toggle-status"))
            ->assertOk()
            ->assertJsonPath('data.is_active', false);
    }

    // Rule 10 — locations and stops are deactivated, never deleted, because
    // past dispatches reference them by name.

    public function test_a_location_cannot_be_deleted_while_it_has_stops(): void
    {
        $this->adminRequest()
            ->deleteJson($this->adminUrl("locations/{$this->gumla->id}"))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Gumla still has 1 stop(s). Delete its stops first.']);

        $this->assertNotSoftDeleted('locations', ['id' => $this->gumla->id]);
    }

    public function test_a_location_cannot_be_deleted_while_it_has_users(): void
    {
        // Clear the stops so only the user blocks the delete.
        $this->gumlaUser->update(['default_stop_id' => null]);
        $this->gumlaStand->delete();

        $this->adminRequest()
            ->deleteJson($this->adminUrl("locations/{$this->gumla->id}"))
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Gumla still has 1 user(s). Remove them first.']);
    }

    public function test_a_location_can_be_deleted_once_it_is_empty(): void
    {
        $this->gumlaUser->update(['default_stop_id' => null]);
        $this->gumlaUser->delete();
        $this->gumlaStand->delete();

        $this->adminRequest()
            ->deleteJson($this->adminUrl("locations/{$this->gumla->id}"))
            ->assertOk();

        $this->assertSoftDeleted('locations', ['id' => $this->gumla->id]);

        $this->adminRequest()
            ->getJson($this->adminUrl('locations'))
            ->assertOk()
            ->assertJsonMissing(['name' => 'Gumla']);
    }

    public function test_a_stop_can_be_deleted_when_another_remains(): void
    {
        $spare = Stop::factory()->create(['location_id' => $this->gumla->id, 'name' => 'Sisai Road']);

        $this->adminRequest()
            ->deleteJson($this->adminUrl("stops/{$spare->id}"))
            ->assertOk();

        $this->assertSoftDeleted('stops', ['id' => $spare->id]);
    }

    public function test_the_last_stop_cannot_be_deleted_while_the_location_has_active_users(): void
    {
        $this->adminRequest()
            ->deleteJson($this->adminUrl("stops/{$this->gumlaStand->id}"))
            ->assertStatus(422);

        $this->assertNotSoftDeleted('stops', ['id' => $this->gumlaStand->id]);
    }

    public function test_deleting_a_stop_clears_it_as_anyones_default(): void
    {
        Stop::factory()->create(['location_id' => $this->gumla->id, 'name' => 'Sisai Road']);

        $this->assertSame($this->gumlaStand->id, $this->gumlaUser->default_stop_id);

        $this->adminRequest()
            ->deleteJson($this->adminUrl("stops/{$this->gumlaStand->id}"))
            ->assertOk();

        $this->assertNull($this->gumlaUser->fresh()->default_stop_id);
    }

    public function test_a_deleted_stop_still_resolves_on_past_dispatches(): void
    {
        $dispatch = Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        $stopName = $dispatch->fromStop->name;

        // Give Gumla a spare stop so the delete is allowed.
        Stop::factory()->create(['location_id' => $this->gumla->id, 'name' => 'Sisai Road']);

        $this->adminRequest()
            ->deleteJson($this->adminUrl("stops/{$dispatch->from_stop_id}"))
            ->assertOk();

        $this->adminRequest()
            ->getJson($this->adminUrl("dispatches/{$dispatch->id}"))
            ->assertOk()
            ->assertJsonPath('data.from_stop.name', $stopName);
    }

    // Users can be removed.

    public function test_an_admin_can_remove_a_user(): void
    {
        $this->adminRequest()
            ->deleteJson($this->adminUrl("users/{$this->lohardagaUser->id}"))
            ->assertOk();

        // Soft deleted: gone from the panel, but the row survives so old
        // dispatches can still resolve the name.
        $this->assertSoftDeleted('logistics_users', ['id' => $this->lohardagaUser->id]);

        $this->adminRequest()
            ->getJson($this->adminUrl('users'))
            ->assertOk()
            ->assertJsonMissing(['mobile' => $this->lohardagaUser->mobile]);
    }

    public function test_a_removed_user_cannot_log_in(): void
    {
        $mobile = $this->lohardagaUser->mobile;

        $this->adminRequest()
            ->deleteJson($this->adminUrl("users/{$this->lohardagaUser->id}"))
            ->assertOk();

        $this->forgetResolvedGuards();

        $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $mobile,
            'password' => 'secret',
        ])->assertStatus(422);
    }

    public function test_removing_a_user_keeps_their_dispatch_history_readable(): void
    {
        $dispatch = Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->received($this->hubUser)->create();

        // Another Gumla user so the delete is not blocked as the last one.
        LogisticsUser::factory()->create(['location_id' => $this->gumla->id]);

        $this->adminRequest()
            ->deleteJson($this->adminUrl("users/{$this->gumlaUser->id}"))
            ->assertOk();

        $this->adminRequest()
            ->getJson($this->adminUrl("dispatches/{$dispatch->id}"))
            ->assertOk()
            ->assertJsonPath('data.sender.name', 'Gumla Staff');
    }

    public function test_removing_the_last_user_at_a_location_with_packages_in_transit_is_refused(): void
    {
        // A parcel is on its way to Simdega and only one person works there.
        Dispatch::factory()->between($this->hubUser, $this->lohardagaUser)->create();

        $this->adminRequest()
            ->deleteJson($this->adminUrl("users/{$this->lohardagaUser->id}"))
            ->assertStatus(422);

        $this->assertNotSoftDeleted('logistics_users', ['id' => $this->lohardagaUser->id]);
    }

    public function test_the_last_user_can_be_removed_once_nothing_is_in_transit(): void
    {
        Dispatch::factory()->between($this->hubUser, $this->lohardagaUser)->received($this->lohardagaUser)->create();

        $this->adminRequest()
            ->deleteJson($this->adminUrl("users/{$this->lohardagaUser->id}"))
            ->assertOk();
    }

    public function test_a_colleague_at_the_location_makes_removal_safe(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();

        // Two people at Ranchi, so removing one leaves someone to receive.
        $this->adminRequest()
            ->deleteJson($this->adminUrl("users/{$this->hubUser->id}"))
            ->assertOk();
    }

    // Stops

    public function test_an_admin_can_add_a_stop(): void
    {
        $this->adminRequest()
            ->postJson($this->adminUrl('stops'), [
                'location_id' => $this->gumla->id,
                'name' => 'Sisai Road',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Sisai Road');
    }

    public function test_stop_names_are_unique_per_location_but_not_globally(): void
    {
        // Same name again in the same location is a duplicate.
        $this->adminRequest()
            ->postJson($this->adminUrl('stops'), [
                'location_id' => $this->gumla->id,
                'name' => 'Gumla Bus Stand',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');

        // The same name in a different location is fine.
        $this->adminRequest()
            ->postJson($this->adminUrl('stops'), [
                'location_id' => $this->lohardaga->id,
                'name' => 'Gumla Bus Stand',
            ])
            ->assertCreated();
    }

    // Locked decision 5 — every location keeps at least one active stop.

    public function test_the_last_active_stop_at_a_location_cannot_be_deactivated(): void
    {
        $this->adminRequest()
            ->patchJson($this->adminUrl("stops/{$this->gumlaStand->id}/toggle-status"))
            ->assertStatus(422);

        $this->assertTrue($this->gumlaStand->fresh()->is_active);
    }

    public function test_a_stop_can_be_deactivated_when_another_active_one_remains(): void
    {
        Stop::factory()->create(['location_id' => $this->gumla->id, 'name' => 'Sisai Road']);

        $this->adminRequest()
            ->patchJson($this->adminUrl("stops/{$this->gumlaStand->id}/toggle-status"))
            ->assertOk()
            ->assertJsonPath('data.is_active', false);
    }

    public function test_listing_a_locations_stops(): void
    {
        Stop::factory()->create(['location_id' => $this->gumla->id, 'name' => 'Sisai Road']);

        $this->adminRequest()
            ->getJson($this->adminUrl("locations/{$this->gumla->id}/stops"))
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    // Dispatch monitoring

    public function test_the_admin_dispatch_list_shows_every_dispatch(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->lohardagaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->hubUser, $this->gumlaUser)->create();

        $this->adminRequest()
            ->getJson($this->adminUrl('dispatches'))
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_the_admin_dispatch_list_filters_by_status_and_search(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create(['reference_no' => 'OD1000']);
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->notReceived()->create(['reference_no' => 'OD1001']);

        $this->adminRequest()
            ->getJson($this->adminUrl('dispatches?status=not_received'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference_no', 'OD1001');

        $this->adminRequest()
            ->getJson($this->adminUrl('dispatches?search=OD1000'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference_no', 'OD1000');
    }

    public function test_dashboard_stats_break_down_by_status_and_location(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->received($this->hubUser)->create();
        Dispatch::factory()->between($this->lohardagaUser, $this->hubUser)->notReceived()->create();

        $response = $this->adminRequest()
            ->getJson($this->adminUrl('dashboard/stats'))
            ->assertOk();

        $response->assertJsonPath('data.totals.total', 3)
            ->assertJsonPath('data.totals.pending', 1)
            ->assertJsonPath('data.totals.received', 1)
            ->assertJsonPath('data.totals.not_received', 1);

        $ranchi = collect($response->json('data.per_location'))->firstWhere('location', 'Ranchi');

        // Ranchi is the receiving end of all three.
        $this->assertSame(1, $ranchi['pending']);
        $this->assertSame(1, $ranchi['received']);
        $this->assertSame(1, $ranchi['not_received']);
        $this->assertSame(0, $ranchi['sent']);

        $gumla = collect($response->json('data.per_location'))->firstWhere('location', 'Gumla');
        $this->assertSame(2, $gumla['sent']);
    }

    public function test_not_received_dispatches_are_surfaced_for_attention(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->notReceived()->create();

        $this->adminRequest()
            ->getJson($this->adminUrl('dashboard/stats'))
            ->assertOk()
            ->assertJsonCount(1, 'data.needs_attention');
    }

    // Locked decision 1 — one user belongs to exactly one location.

    public function test_a_user_has_exactly_one_location(): void
    {
        $user = LogisticsUser::factory()->create([
            'location_id' => $this->gumla->id,
            'default_stop_id' => $this->gumlaStand->id,
        ]);

        $this->assertSame($this->gumla->id, $user->location_id);
        $this->assertInstanceOf(Location::class, $user->location);
    }
}
