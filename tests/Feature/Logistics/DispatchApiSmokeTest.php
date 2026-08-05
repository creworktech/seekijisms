<?php

namespace Tests\Feature\Logistics;

use App\Jobs\SendDispatchNotification;
use App\Models\Dispatch;
use App\Models\DispatchEvent;
use App\Models\NotificationLog;
use Illuminate\Support\Facades\Queue;

/**
 * End-to-end wiring check for the logistics API: login, bootstrap, create,
 * confirm receipt. The exhaustive business-rule suite lives alongside this.
 */
class DispatchApiSmokeTest extends LogisticsTestCase
{
    public function test_a_spoke_user_can_log_in_and_receives_a_token(): void
    {
        $response = $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'secret',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.mobile', $this->gumlaUser->mobile)
            ->assertJsonPath('data.user.role', 'spoke')
            ->assertJsonPath('data.permissions.is_central', false)
            ->assertJsonStructure(['data' => ['token', 'user', 'permissions']]);

        $this->assertNotNull($this->gumlaUser->fresh()->last_login_at);
    }

    public function test_bootstrap_returns_only_hub_receivers_for_a_spoke_user(): void
    {
        $response = $this->actingAs($this->gumlaUser, 'logistics')
            ->getJson($this->apiUrl('bootstrap'));

        $response->assertOk()
            ->assertJsonPath('data.location.name', 'Gumla')
            ->assertJsonPath('data.counts.send_pending', 0);

        $receiverGroups = $response->json('data.receivers');

        // Exactly one group — the hub — and every user in it is central.
        $this->assertCount(1, $receiverGroups);
        $this->assertSame('Ranchi', $receiverGroups[0]['location']['name']);

        foreach ($receiverGroups[0]['users'] as $user) {
            $this->assertTrue($user['is_central'], 'A spoke user must only ever see central receivers.');
        }
    }

    public function test_bootstrap_returns_spoke_receivers_grouped_by_location_for_a_central_user(): void
    {
        $response = $this->actingAs($this->hubUser, 'logistics')
            ->getJson($this->apiUrl('bootstrap'));

        $response->assertOk()->assertJsonPath('data.location.name', 'Ranchi');

        $groups = collect($response->json('data.receivers'));
        $names = $groups->pluck('location.name')->sort()->values()->all();

        $this->assertSame(['Gumla', 'Lohardaga'], $names);
    }

    public function test_a_dispatch_can_be_created_and_then_confirmed_by_the_receiver(): void
    {
        Queue::fake();

        $create = $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload());

        $create->assertCreated()
            ->assertJsonPath('data.reference_no', 'OD0001')
            ->assertJsonPath('data.status', 'pending')
            // bus_number is upper-cased server side.
            ->assertJsonPath('data.bus_number', 'JH01AB1234');

        $dispatch = Dispatch::firstOrFail();

        $this->assertCount(1, $dispatch->photos()->where('type', 'bus')->get());
        $this->assertCount(1, $dispatch->photos()->where('type', 'package')->get());

        Queue::assertPushed(SendDispatchNotification::class, fn ($job) => $job->event === SendDispatchNotification::EVENT_CREATED);

        // Exactly one creation event, attributed to the sender.
        $this->assertSame(1, DispatchEvent::where('dispatch_id', $dispatch->id)->count());
        $this->assertSame($this->gumlaUser->id, DispatchEvent::first()->user_id);

        $receive = $this->actingAs($this->hubUser, 'logistics')
            ->post($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'received',
                'latitude' => 23.3441,
                'longitude' => 85.3096,
                'receipt_photo' => $this->photo('receipt.jpg'),
            ]);

        $receive->assertOk()->assertJsonPath('data.status', 'received');

        $dispatch->refresh();
        $this->assertSame($this->hubUser->id, $dispatch->received_by);
        $this->assertNotNull($dispatch->received_at);
        $this->assertCount(1, $dispatch->photos()->where('type', 'receipt')->get());
        $this->assertSame(2, DispatchEvent::where('dispatch_id', $dispatch->id)->count());

        Queue::assertPushed(SendDispatchNotification::class, fn ($job) => $job->event === SendDispatchNotification::EVENT_RECEIVED);
    }

    public function test_reference_numbers_increment_without_gaps(): void
    {
        Queue::fake();

        foreach (['OD0001', 'OD0002', 'OD0003'] as $expected) {
            $this->actingAs($this->gumlaUser, 'logistics')
                ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
                ->assertCreated()
                ->assertJsonPath('data.reference_no', $expected);
        }
    }

    public function test_notifications_go_out_over_whatsapp_and_are_logged(): void
    {
        // An admin has to exist on file to be one of the Not Received
        // recipients; administration is a Service Management identity.
        $this->webAdmin();
        $this->forgetResolvedGuards();

        // QUEUE_CONNECTION is sync in tests, so the job runs inline and the
        // WhatsApp service records a simulated send (no Meta credentials set).
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        $created = NotificationLog::where('dispatch_id', $dispatch->id)->get();
        $this->assertCount(1, $created, 'Creating a dispatch notifies the receiver.');
        $this->assertSame('logistics_dispatch_created', $created->first()->template);

        $this->actingAs($this->hubUser, 'logistics')
            ->post($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Conductor did not hand the parcel over.',
            ])->assertOk();

        // Not Received reaches the sender and every Service Management admin.
        $notReceived = NotificationLog::where('dispatch_id', $dispatch->id)
            ->where('template', 'logistics_dispatch_not_received')
            ->get();

        $this->assertCount(2, $notReceived, 'Not Received notifies the sender and the admin.');
    }

    public function test_not_received_reaches_the_sender_even_with_no_admin_on_file(): void
    {
        // No Service Management admin exists in this test, so only the sender
        // is messaged — the transition itself must still succeed.
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload())
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        $this->actingAs($this->hubUser, 'logistics')
            ->post($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Conductor did not hand the parcel over.',
            ])->assertOk();

        $this->assertSame('not_received', $dispatch->fresh()->status->value);
        $this->assertSame(
            1,
            NotificationLog::where('dispatch_id', $dispatch->id)
                ->where('template', 'logistics_dispatch_not_received')
                ->count()
        );
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson($this->apiUrl('bootstrap'))->assertUnauthorized();
        $this->getJson($this->apiUrl('dispatches/sent'))->assertUnauthorized();
    }
}
