<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Job;
use App\Models\JobPayment;
use App\Models\User;
use App\Services\JobWorkflow;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Client requirement: customers sometimes pay only part of the bill, and the
 * remaining balance must be tracked (and later collectible) properly —
 * rather than the old behaviour where collecting any amount silently
 * overwrote the bill and flagged the job fully paid regardless.
 */
class JobPartialPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Customer $customer;
    protected JobWorkflow $workflow;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create(['is_active' => true]);
        $this->admin->assignRole('admin');

        $this->customer = Customer::create([
            'customer_code' => 'ID001',
            'name' => 'Test Customer',
            'mobile' => '9876543210',
            'address' => 'Test Address',
            'registered_on' => now()->format('Y-m-d'),
        ]);

        $this->workflow = app(JobWorkflow::class);
    }

    /**
     * A completed job with a ₹3000 bill and nothing collected yet.
     */
    protected function completedJob(float $bill = 3000): Job
    {
        return Job::create([
            'token_no' => 'TKN-' . rand(100000, 999999),
            'customer_id' => $this->customer->id,
            'product_name' => 'Stabilizer 5KVA',
            'fault_description' => 'Fluctuating voltage.',
            'received_from' => 'self',
            'priority' => 'medium',
            'stage' => 'completed',
            'outcome' => 'work_done',
            'final_amount' => $bill,
            'payable_amount' => $bill,
            'in_date' => now()->format('Y-m-d'),
            'created_by' => $this->admin->id,
        ]);
    }

    // The bill must never be silently overwritten by what's collected

    public function test_collecting_part_of_the_bill_leaves_the_bill_amount_untouched(): void
    {
        $job = $this->completedJob(3000);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'collect_payment',
            'payment_mode' => 'cash',
            'paid_amount' => 1000,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('ready', $response->json('data.stage'));
        $this->assertEquals(3000, $response->json('data.payable_amount'));
        $this->assertEquals(1000, $response->json('data.paid_amount'));
        $this->assertEquals(2000, $response->json('data.due_amount'));
        $this->assertEquals('partial', $response->json('data.payment_status'));
        $this->assertFalse($response->json('data.is_paid'));
    }

    public function test_a_partial_payment_is_recorded_in_the_ledger(): void
    {
        $job = $this->completedJob(3000);

        $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'collect_payment',
            'payment_mode' => 'upi',
            'paid_amount' => 1200,
            'remarks' => 'Advance payment',
        ])->assertStatus(200);

        $this->assertDatabaseHas('job_payments', [
            'job_id' => $job->id,
            'amount' => 1200,
            'payment_mode' => 'upi',
            'remarks' => 'Advance payment',
            'collected_by' => $this->admin->id,
        ]);
    }

    public function test_paying_the_full_amount_marks_the_job_paid(): void
    {
        $job = $this->completedJob(3000);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'collect_payment',
            'payment_mode' => 'cash',
            'paid_amount' => 3000,
        ]);

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.is_paid'));
        $this->assertEquals('paid', $response->json('data.payment_status'));
        $this->assertEquals(0, $response->json('data.due_amount'));
    }

    public function test_omitting_paid_amount_still_collects_the_full_due_as_before(): void
    {
        $job = $this->completedJob(3000);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'collect_payment',
            'payment_mode' => 'cash',
        ]);

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.is_paid'));
        $this->assertEquals(3000, $response->json('data.paid_amount'));
    }

    public function test_collecting_more_than_the_due_amount_is_rejected(): void
    {
        $job = $this->completedJob(3000);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'collect_payment',
            'payment_mode' => 'cash',
            'paid_amount' => 5000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('paid_amount');
        $this->assertEquals(0, (float) $job->fresh()->paid_amount);
    }

    public function test_release_unpaid_leaves_the_full_bill_due(): void
    {
        $job = $this->completedJob(3000);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'release_unpaid',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('ready', $response->json('data.stage'));
        $this->assertFalse($response->json('data.is_paid'));
        $this->assertEquals(3000, $response->json('data.due_amount'));
    }

    // Settling the remaining balance later, from any stage

    public function test_the_remaining_balance_can_be_collected_after_a_partial_payment(): void
    {
        $job = $this->completedJob(3000);

        $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/transition", [
            'action' => 'collect_payment',
            'payment_mode' => 'cash',
            'paid_amount' => 1000,
        ])->assertStatus(200);

        // The job has moved on to 'ready' — settling the balance must not
        // require moving it anywhere.
        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/collect-due-payment", [
            'amount' => 2000,
            'payment_mode' => 'upi',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('ready', $response->json('data.stage'));
        $this->assertTrue($response->json('data.is_paid'));
        $this->assertEquals(0, $response->json('data.due_amount'));
        $this->assertEquals(3000, $response->json('data.paid_amount'));

        $this->assertDatabaseHas('job_payments', [
            'job_id' => $job->id,
            'amount' => 2000,
            'payment_mode' => 'upi',
        ]);
        $this->assertSame(2, JobPayment::where('job_id', $job->id)->count());
    }

    public function test_due_payment_can_be_collected_even_after_delivery(): void
    {
        $job = $this->completedJob(3000);
        $job->update(['stage' => 'delivered', 'paid_amount' => 500]);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/collect-due-payment", [
            'amount' => 2500,
            'payment_mode' => 'cash',
        ]);

        $response->assertStatus(200);
        $this->assertEquals('delivered', $response->json('data.stage'), 'Collecting a due payment must not move the stage.');
        $this->assertTrue($response->json('data.is_paid'));
    }

    /**
     * Found via a real-data check before shipping this migration: a job
     * with a ₹0 bill (e.g. waived, or no inspection fee configured) has
     * nothing outstanding and must read as settled, not unpaid — even
     * though paid_amount is also 0, since nothing needed collecting.
     */
    public function test_a_zero_amount_bill_reads_as_paid_not_unpaid(): void
    {
        $job = $this->completedJob(0);
        $job->update(['is_paid' => true]);

        $this->assertSame('paid', $job->fresh()->paymentStatus());
        $this->assertSame(0.0, $job->fresh()->dueAmount());
    }

    public function test_a_job_with_no_due_amount_refuses_a_due_payment(): void
    {
        $job = $this->completedJob(3000);
        $job->update(['paid_amount' => 3000, 'is_paid' => true]);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/collect-due-payment", [
            'amount' => 100,
            'payment_mode' => 'cash',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('amount');
    }

    public function test_due_payment_cannot_exceed_the_outstanding_balance(): void
    {
        $job = $this->completedJob(3000);
        $job->update(['paid_amount' => 1000]);

        $response = $this->actingAs($this->admin)->postJson("/api/v1/jobs/{$job->id}/collect-due-payment", [
            'amount' => 2500,
            'payment_mode' => 'cash',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('amount');
    }

    // Reporting totals reflect partial payments correctly

    public function test_dashboard_revenue_and_dues_account_for_partial_payments(): void
    {
        $fullyPaid = $this->completedJob(2000);
        $fullyPaid->update(['stage' => 'ready', 'paid_amount' => 2000, 'is_paid' => true]);

        $partiallyPaid = $this->completedJob(3000);
        $partiallyPaid->update(['stage' => 'ready', 'paid_amount' => 1000, 'is_paid' => false]);

        $unpaid = $this->completedJob(500);
        $unpaid->update(['stage' => 'ready']);

        $response = $this->actingAs($this->admin)->getJson('/api/v1/dashboard/stats');

        $response->assertStatus(200);
        // Revenue: money actually collected across all three (2000 + 1000 + 0).
        $this->assertEquals(3000, $response->json('data.tiles.total_revenue'));
        // Dues: what's actually still owed (0 + 2000 + 500), not the full
        // bill of the partially-paid job.
        $this->assertEquals(2500, $response->json('data.tiles.dues_amount'));
    }

    /**
     * The migration's backfill: for a row already marked paid before this
     * feature existed, the value sitting in payable_amount at that moment
     * WAS what got collected (the old bug overwrote it), so copying it into
     * paid_amount is the correct, safe reconstruction — never destructive,
     * never invented data.
     */
    public function test_the_backfill_formula_matches_pre_existing_paid_and_unpaid_rows(): void
    {
        $paidBeforeMigration = $this->completedJob(1800);
        $paidBeforeMigration->forceFill(['is_paid' => true, 'paid_amount' => 0])->save();

        $unpaidBeforeMigration = $this->completedJob(900);
        $unpaidBeforeMigration->forceFill(['is_paid' => false, 'paid_amount' => 0])->save();

        // The exact statement the migration runs.
        DB::table('jobs')
            ->where('is_paid', true)
            ->whereNotNull('payable_amount')
            ->update(['paid_amount' => DB::raw('payable_amount')]);

        $this->assertEquals(1800, (float) $paidBeforeMigration->fresh()->paid_amount);
        $this->assertEquals(0, (float) $unpaidBeforeMigration->fresh()->paid_amount);
        $this->assertEquals(0, $paidBeforeMigration->fresh()->dueAmount());
        $this->assertEquals(900, $unpaidBeforeMigration->fresh()->dueAmount());
    }
}
