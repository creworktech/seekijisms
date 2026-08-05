<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\DispatchEvent;
use App\Models\DispatchPhoto;
use App\Models\NotificationLog;
use Illuminate\Support\Str;

/**
 * The mobile offline queue retries an upload whose response never arrived.
 * A retry must never produce a second parcel.
 */
class DispatchIdempotencyTest extends LogisticsTestCase
{
    public function test_replaying_the_same_client_uuid_returns_the_original_dispatch(): void
    {
        $uuid = (string) Str::uuid();

        $first = $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => $uuid]))
            ->assertCreated();

        $reference = $first->json('data.reference_no');

        // The app never saw the response, so it sends the whole thing again.
        $second = $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => $uuid]))
            // 200, not 201 — nothing new was created.
            ->assertOk();

        $this->assertSame($reference, $second->json('data.reference_no'));
        $this->assertSame(1, Dispatch::count(), 'A retry must not create a second dispatch.');
    }

    public function test_a_replay_does_not_duplicate_photos_events_or_notifications(): void
    {
        $this->webAdmin();
        $this->forgetResolvedGuards();

        $uuid = (string) Str::uuid();
        $payload = fn () => $this->validDispatchPayload(['client_uuid' => $uuid]);

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $payload())->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $payload())->assertOk();

        $this->assertSame(1, DispatchPhoto::where('dispatch_id', $dispatch->id)->where('type', 'bus')->count());
        $this->assertSame(1, DispatchPhoto::where('dispatch_id', $dispatch->id)->where('type', 'package')->count());
        $this->assertSame(1, DispatchEvent::where('dispatch_id', $dispatch->id)->count());
        $this->assertSame(1, NotificationLog::where('dispatch_id', $dispatch->id)->count());
    }

    public function test_a_replay_does_not_consume_a_reference_number(): void
    {
        $uuid = (string) Str::uuid();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => $uuid]))
            ->assertCreated()
            ->assertJsonPath('data.reference_no', 'OD0001');

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => $uuid]))
            ->assertOk();

        // The next genuine dispatch is OD0002, not OD0003.
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => (string) Str::uuid()]))
            ->assertCreated()
            ->assertJsonPath('data.reference_no', 'OD0002');
    }

    public function test_different_client_uuids_create_separate_dispatches(): void
    {
        foreach ([1, 2, 3] as $i) {
            $this->actingAs($this->gumlaUser, 'logistics')
                ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => (string) Str::uuid()]))
                ->assertCreated();
        }

        $this->assertSame(3, Dispatch::count());
    }

    public function test_the_key_is_optional_so_other_clients_still_work(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();

        $this->assertNull(Dispatch::firstOrFail()->client_uuid);
    }

    public function test_a_malformed_key_is_rejected(): void
    {
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => 'not-a-uuid']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('client_uuid');
    }

    public function test_the_database_refuses_a_duplicate_key_outright(): void
    {
        $uuid = (string) Str::uuid();

        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create(['client_uuid' => $uuid]);

        // The UNIQUE index is the real guard behind the application check.
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create(['client_uuid' => $uuid]);
    }

    public function test_a_replay_from_a_different_user_still_returns_the_original(): void
    {
        $uuid = (string) Str::uuid();

        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload(['client_uuid' => $uuid]))
            ->assertCreated();

        // A reinstalled app signed in as someone else must not be able to
        // mint a duplicate by reusing a key it happens to still hold.
        $this->actingAs($this->lohardagaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'client_uuid' => $uuid,
                'from_stop_id' => $this->lohardagaStand->id,
            ]))
            ->assertOk();

        $this->assertSame(1, Dispatch::count());
    }
}
