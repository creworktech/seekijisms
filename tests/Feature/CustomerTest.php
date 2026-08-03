<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');
    }

    /** @test */
    public function duplicate_mobile_number_returns_422_with_existing_customer(): void
    {
        $existing = Customer::create([
            'customer_code' => 'ID001',
            'name' => 'Rajesh Kumar',
            'mobile' => '9876543210',
            'address' => 'Sample Address Line 1',
            'registered_on' => now()->format('Y-m-d'),
        ]);

        $response = $this->actingAs($this->admin)->postJson('/api/v1/customers', [
            'name' => 'Rajesh Copy',
            'mobile' => '9876543210',
            'address' => 'Sample Address Line 2',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'This mobile number is already registered.',
            'existing_customer' => [
                'id' => $existing->id,
                'customer_code' => 'ID001',
                'name' => 'Rajesh Kumar',
            ],
        ]);
    }

    /** @test */
    public function check_mobile_endpoint_returns_availability(): void
    {
        Customer::create([
            'customer_code' => 'ID001',
            'name' => 'Rajesh Kumar',
            'mobile' => '9876543210',
            'address' => 'Sample Address Line 1',
            'registered_on' => now()->format('Y-m-d'),
        ]);

        // Existing mobile
        $res1 = $this->actingAs($this->admin)->getJson('/api/v1/customers/check-mobile?mobile=9876543210');
        $res1->assertStatus(200);
        $res1->assertJson(['available' => false, 'existing_customer' => ['name' => 'Rajesh Kumar']]);

        // Available mobile
        $res2 = $this->actingAs($this->admin)->getJson('/api/v1/customers/check-mobile?mobile=9876543999');
        $res2->assertStatus(200);
        $res2->assertJson(['available' => true, 'existing_customer' => null]);
    }

    /** @test */
    public function customer_code_is_automatically_generated(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/customers', [
            'name' => 'New Customer',
            'mobile' => '9876543111',
            'address' => 'Random Street Address',
        ]);

        $response->assertStatus(201);
        $this->assertNotEmpty($response->json('data.customer_code'));
        $this->assertStringStartsWith('C', $response->json('data.customer_code'));
        $this->assertEquals('C00001', $response->json('data.customer_code'));
        $this->assertFalse($response->json('data.is_active'));
    }

    /** @test */
    public function only_admin_can_update_customer_details(): void
    {
        $customer = Customer::create([
            'customer_code' => 'ID001',
            'name' => 'Original Name',
            'mobile' => '9876543210',
            'address' => 'Original Address',
            'registered_on' => now()->format('Y-m-d'),
        ]);

        $nonAdmin = User::factory()->create(['is_active' => true]);
        $nonAdmin->assignRole('intake_coordinator');

        // Non-admin update fails
        $failRes = $this->actingAs($nonAdmin)->putJson("/api/v1/customers/{$customer->id}", [
            'name' => 'Updated Name',
        ]);
        $failRes->assertStatus(403);

        // Admin update succeeds
        $successRes = $this->actingAs($this->admin)->putJson("/api/v1/customers/{$customer->id}", [
            'name' => 'Updated Name By Admin',
            'mobile' => '9876543210',
            'address' => 'Updated Address',
        ]);
        $successRes->assertStatus(200);
        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Updated Name By Admin',
        ]);
    }

    /** @test */
    public function only_admin_can_toggle_customer_status(): void
    {
        $customer = Customer::create([
            'customer_code' => 'C00001',
            'name' => 'Test Customer',
            'mobile' => '9876543210',
            'address' => 'Test Address',
            'is_active' => false,
            'registered_on' => now()->format('Y-m-d'),
        ]);

        $nonAdmin = User::factory()->create(['is_active' => true]);
        $nonAdmin->assignRole('intake_coordinator');

        // Non-admin toggle fails
        $failRes = $this->actingAs($nonAdmin)->patchJson("/api/v1/customers/{$customer->id}/toggle-status");
        $failRes->assertStatus(403);

        // Admin toggle succeeds
        $successRes = $this->actingAs($this->admin)->patchJson("/api/v1/customers/{$customer->id}/toggle-status");
        $successRes->assertStatus(200);
        $this->assertTrue($customer->fresh()->is_active);
    }
}
