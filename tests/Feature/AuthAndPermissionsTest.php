<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Job;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthAndPermissionsTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $coordinator;
    protected Job $job;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        $this->coordinator = User::factory()->create(['is_active' => true]);
        $this->coordinator->assignRole('intake_coordinator');

        $customer = Customer::create([
            'customer_code' => 'ID001',
            'name' => 'Customer One',
            'mobile' => '9876543210',
            'address' => 'Sample Address',
            'registered_on' => now()->format('Y-m-d'),
        ]);

        $this->job = Job::create([
            'token_no' => 'TKN-2849',
            'customer_id' => $customer->id,
            'product_name' => 'Stabilizer 5KVA',
            'fault_description' => 'Fault text',
            'received_from' => 'self',
            'stage' => 'ready',
            'in_date' => now()->format('Y-m-d'),
            'created_by' => $this->admin->id,
        ]);
    }

    /** @test */
    public function intake_coordinator_cannot_call_general_transition_endpoint(): void
    {
        $response = $this->actingAs($this->coordinator)->postJson("/api/v1/jobs/{$this->job->id}/transition", [
            'action' => 'deliver',
            'delivery_mode' => 'self',
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function intake_coordinator_can_call_deliver_endpoint(): void
    {
        $response = $this->actingAs($this->coordinator)->postJson("/api/v1/jobs/{$this->job->id}/deliver", [
            'delivery_mode' => 'self',
            'delivery_receiver' => 'Customer One',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('delivered', $response->json('data.stage'));
    }

    /** @test */
    public function disabled_user_cannot_authenticate(): void
    {
        $disabledUser = User::factory()->create([
            'email' => 'disabled@seekoji.com',
            'password' => bcrypt('password123'),
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'disabled@seekoji.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
    }

    /** @test */
    public function cannot_deactivate_last_active_admin(): void
    {
        $otherAdmin = User::factory()->create(['is_active' => true]);
        $otherAdmin->assignRole('admin');

        $response = $this->actingAs($otherAdmin)->patchJson("/api/v1/users/{$this->admin->id}/toggle-status");

        // Allowed when there are 2 active admins
        $response->assertStatus(200);

        // Now try deactivating the remaining active admin
        $response2 = $this->actingAs($this->admin)->patchJson("/api/v1/users/{$otherAdmin->id}/toggle-status");
        $response2->assertStatus(422);
    }

    /** @test */
    public function non_admin_cannot_access_accounts_module(): void
    {
        $response = $this->actingAs($this->coordinator)->get('/accounts');
        $response->assertStatus(403);

        $adminRes = $this->actingAs($this->admin)->get('/accounts');
        $adminRes->assertStatus(200);
    }
}
