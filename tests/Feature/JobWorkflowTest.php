<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Job;
use App\Models\JobEvent;
use App\Models\Setting;
use App\Models\User;
use App\Services\JobWorkflow;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JobWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $tester;
    protected User $tech;
    protected Customer $customer;
    protected JobWorkflow $workflow;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);

        Setting::set('inspection_fee', '250');

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        $this->tester = User::factory()->create(['is_active' => true]);
        $this->tester->assignRole('tester');

        $this->tech = User::factory()->create(['is_active' => true]);
        $this->tech->assignRole('technician');

        $this->customer = Customer::create([
            'customer_code' => 'ID001',
            'name' => 'Test Customer',
            'mobile' => '9876543210',
            'address' => 'Test Address',
            'registered_on' => now()->format('Y-m-d'),
        ]);

        $this->workflow = app(JobWorkflow::class);
    }

    protected function createJobInStage(string $stage = 'new'): Job
    {
        return Job::create([
            'token_no' => 'TKN-' . rand(1000, 9999),
            'customer_id' => $this->customer->id,
            'product_name' => 'Stabilizer 5KVA',
            'fault_description' => 'Fluctuating voltage.',
            'received_from' => 'self',
            'priority' => 'medium',
            'stage' => $stage,
            'in_date' => now()->format('Y-m-d'),
            'created_by' => $this->admin->id,
        ]);
    }

    /** @test */
    public function new_to_testing_via_assign_tester(): void
    {
        $job = $this->createJobInStage('new');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'assign_tester',
            'tester_id' => $this->tester->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('testing', $response->json('data.stage'));
        $this->assertEquals($this->tester->id, $response->json('data.tester_id'));

        $this->assertDatabaseHas('job_events', [
            'job_id' => $job->id,
            'action' => 'assign_tester',
            'from_stage' => 'new',
            'to_stage' => 'testing',
            'user_id' => $this->admin->id,
        ]);
    }

    /** @test */
    public function testing_to_approval_via_fault_found(): void
    {
        $job = $this->createJobInStage('testing');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'fault_found',
            'estimated_budget' => 3200,
            'tester_findings' => 'Capacitor burnt out.',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('approval', $response->json('data.stage'));
        $this->assertEquals(3200, $response->json('data.estimated_budget'));
    }

    /** @test */
    public function approval_to_repair_via_approve(): void
    {
        $job = $this->createJobInStage('approval');
        $job->update(['estimated_budget' => 3200]);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'approve',
            'approved_amount' => 3000,
            'technician_id' => $this->tech->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('repair', $response->json('data.stage'));
        $this->assertEquals(3000, $response->json('data.approved_amount'));
        $this->assertEquals($this->tech->id, $response->json('data.technician_id'));
    }

    /** @test */
    public function repair_to_completed_via_work_done(): void
    {
        $job = $this->createJobInStage('repair');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'work_done',
            'final_amount' => 3500,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('completed', $response->json('data.stage'));
        $this->assertEquals('work_done', $response->json('data.outcome'));
        $this->assertEquals(3500, $response->json('data.payable_amount'));
    }

    /** @test */
    public function pending_to_repair_round_trip(): void
    {
        $job = $this->createJobInStage('repair');

        // Mark pending
        $res1 = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'mark_pending',
            'pend_reason' => 'Waiting for spare part',
        ]);
        $res1->assertStatus(200);
        $this->assertEquals('pending', $res1->json('data.stage'));
        $this->assertEquals('Waiting for spare part', $res1->json('data.pend_reason'));

        // Resume to repair
        $res2 = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'move_to_work',
        ]);
        $res2->assertStatus(200);
        $this->assertEquals('repair', $res2->json('data.stage'));
        $this->assertNull($res2->json('data.pend_reason'));
    }

    /** @test */
    public function invalid_stage_transition_returns_409(): void
    {
        $job = $this->createJobInStage('testing');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'work_done',
            'final_amount' => 2000,
        ]);

        $response->assertStatus(409);
        $response->assertJsonStructure(['message', 'errors' => ['action']]);
    }

    /** @test */
    public function fault_found_without_budget_returns_422(): void
    {
        $job = $this->createJobInStage('testing');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'fault_found',
        ]);

        $response->assertStatus(422);
    }

    /** @test */
    public function approve_without_technician_returns_422(): void
    {
        $job = $this->createJobInStage('approval');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'approve',
            'approved_amount' => 1500,
        ]);

        $response->assertStatus(422);
    }

    /** @test */
    public function deliver_without_delivery_mode_returns_422(): void
    {
        $job = $this->createJobInStage('ready');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/deliver", []);

        $response->assertStatus(422);
    }

    /** @test */
    public function delivered_stage_is_terminal_and_rejects_further_actions(): void
    {
        $job = $this->createJobInStage('delivered');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'work_done',
            'final_amount' => 1000,
        ]);

        $response->assertStatus(409);
    }

    /** @test */
    public function inspection_fee_is_snapshotted_on_not_repairable_outcome(): void
    {
        Setting::set('inspection_fee', '350');
        $job = $this->createJobInStage('testing');

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'not_repairable',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('completed', $response->json('data.stage'));
        $this->assertEquals('not_repairable', $response->json('data.outcome'));
        $this->assertEquals(350, $response->json('data.payable_amount'));
    }

    /** @test */
    public function multi_product_intake_creates_multiple_work_orders(): void
    {
        $payload = [
            'customer_id' => $this->customer->id,
            'received_from' => 'self',
            'products' => [
                [
                    'product_name' => 'Solar Inverter 2KVA',
                    'brand' => 'Luminous',
                    'serial_no' => 'SN001',
                    'fault_description' => 'Overheating issue',
                ],
                [
                    'product_name' => 'Submersible Pump Box',
                    'brand' => 'Crompton',
                    'serial_no' => 'SN002',
                    'fault_description' => 'Contactor chattering',
                ],
                [
                    'product_name' => 'ABB ACS580 VFD Drive',
                    'brand' => 'ABB',
                    'serial_no' => 'SN003',
                    'fault_description' => 'Err04 Output phase loss',
                ],
            ],
        ];

        $response = $this->actingAs($this->admin)->postJson('/api/v1/jobs', $payload);

        $response->assertStatus(201);
        $this->assertEquals(3, $response->json('count'));
        $this->assertCount(3, Job::where('customer_id', $this->customer->id)->get());
    }

    /** @test */
    public function only_admin_can_delete_work_orders(): void
    {
        $nonAdmin = User::factory()->create();
        $nonAdmin->assignRole('intake_coordinator');

        $job = Job::create([
            'token_no' => 'SES9999',
            'customer_id' => $this->customer->id,
            'product_name' => 'Test Inverter',
            'fault_description' => 'Test fault',
            'stage' => 'new',
            'priority' => 'medium',
            'received_from' => 'self',
            'in_date' => now()->toDateString(),
            'created_by' => $this->admin->id,
        ]);

        $this->actingAs($nonAdmin)
            ->deleteJson("/api/v1/jobs/{$job->id}")
            ->assertStatus(403);

        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/jobs/{$job->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('jobs', ['id' => $job->id]);
    }
}
