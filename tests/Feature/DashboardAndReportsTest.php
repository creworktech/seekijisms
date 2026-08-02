<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardAndReportsTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->admin = User::where('email', 'admin@seekoji.com')->first();
    }

    /** @test */
    public function dashboard_stats_returns_expected_tiles_and_stage_counts(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/dashboard/stats');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'tiles' => ['today_received', 'total_revenue', 'dues_amount', 'cancelled_jobs'],
                'stages' => ['new', 'testing', 'approval', 'repair', 'pending', 'completed', 'ready', 'delivered'],
                'outcomes',
                'high_priority',
            ]
        ]);

        $stages = $response->json('data.stages');
        $this->assertGreaterThanOrEqual(1, $stages['new']);
        $this->assertGreaterThanOrEqual(1, $stages['testing']);
        $this->assertGreaterThanOrEqual(1, $stages['delivered']);
    }

    /** @test */
    public function reports_jobs_are_ordered_by_id_asc(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/reports/jobs');

        $response->assertStatus(200);
        $jobs = $response->json('data');

        $this->assertNotEmpty($jobs);
        $ids = array_column($jobs, 'id');
        $sortedIds = $ids;
        sort($sortedIds);

        $this->assertEquals($sortedIds, $ids, 'Report jobs should be strictly ordered by id ASC');
    }

    /** @test */
    public function reports_export_returns_202_queued_response(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/reports/jobs/export?format=csv');

        $response->assertStatus(202);
        $response->assertJsonStructure([
            'message',
            'data' => ['export_id', 'format', 'status', 'download_url']
        ]);
    }

    /** @test */
    public function accounts_page_loads_with_summary_and_transactions(): void
    {
        $response = $this->actingAs($this->admin)->get('/accounts');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Accounts/Index')
            ->has('summary.total_revenue')
            ->has('summary.total_dues')
            ->has('summary.period_revenue')
            ->has('customers')
            ->has('transactions')
        );
    }
}
