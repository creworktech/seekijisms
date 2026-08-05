<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia;

/**
 * The Inertia admin panel. Pages are read-only and reachable only by a
 * Service Management web user holding users.manage.
 */
class LogisticsPanelTest extends LogisticsTestCase
{
    private User $webAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        // These are browser pages, not API endpoints. The base class asks for
        // JSON, which would make the auth middleware answer 401 instead of
        // redirecting to the login screen.
        $this->withHeader('Accept', 'text/html,application/xhtml+xml');

        $this->seed(RolesAndPermissionsSeeder::class);

        $this->webAdmin = User::factory()->create(['is_active' => true]);
        $this->webAdmin->assignRole('admin');
    }

    /** @return string[] */
    private function panelUris(): array
    {
        return ['/logistics', '/logistics/dispatches', '/logistics/users', '/logistics/settings'];
    }

    public function test_a_guest_is_redirected_to_login_from_every_panel_page(): void
    {
        foreach ($this->panelUris() as $uri) {
            $this->get($uri)->assertRedirect('/login');
        }
    }

    public function test_a_web_user_without_manage_permission_is_refused(): void
    {
        $tester = User::factory()->create(['is_active' => true]);
        $tester->assignRole('tester');

        foreach ($this->panelUris() as $uri) {
            $this->actingAs($tester, 'web')->get($uri)->assertForbidden();
        }
    }

    public function test_the_dashboard_renders_with_totals_and_breakdown(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->received($this->hubUser)->create();
        Dispatch::factory()->between($this->lohardagaUser, $this->hubUser)->notReceived()->create();

        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Logistics/Dashboard')
                ->where('stats.total', 3)
                ->where('stats.pending', 1)
                ->where('stats.received', 1)
                ->where('stats.not_received', 1)
                ->has('perLocation', 3)
                ->has('recentDispatches', 3)
                ->missing('needsAttention')
                // Nested resources must arrive flat. JsonResource is
                // Responsable, so an unresolved one reaches the page as
                // {"data": {...}} and every name renders blank.
                ->has('recentDispatches.0.sender.name')
                ->has('recentDispatches.0.receiver.name')
                ->has('recentDispatches.0.from_stop.name')
                ->has('recentDispatches.0.to_stop.name')
                ->missing('recentDispatches.0.sender.data')
                ->missing('recentDispatches.0.from_stop.data')
            );
    }

    public function test_the_dispatch_list_renders_and_filters_server_side(): void
    {
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create(['reference_no' => 'OD2001']);
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->notReceived()->create(['reference_no' => 'OD2002']);

        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/dispatches')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Logistics/Dispatches')
                ->has('dispatches.data', 2)
                ->has('locations', 3)
            );

        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/dispatches?status=not_received')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('dispatches.data', 1)
                ->where('dispatches.data.0.reference_no', 'OD2002')
            );

        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/dispatches?search=OD2001')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('dispatches.data', 1)
                ->where('dispatches.data.0.reference_no', 'OD2001')
            );
    }

    public function test_the_detail_page_carries_photos_and_the_event_timeline(): void
    {
        // Two bus photos and one package photo, so a count assertion cannot
        // pass by coincidence against a {"data": [...]} wrapper of size one.
        $this->actingAs($this->gumlaUser, 'logistics')
            ->post($this->apiUrl('dispatches'), $this->validDispatchPayload([
                'bus_photos' => [$this->photo('bus1.jpg'), $this->photo('bus2.jpg')],
                'package_photos' => [$this->photo('pkg.jpg')],
            ]))
            ->assertCreated();

        $dispatch = Dispatch::firstOrFail();

        $this->actingAs($this->hubUser, 'logistics')
            ->postJson($this->apiUrl("dispatches/{$dispatch->id}/receive"), [
                'action' => 'not_received',
                'note' => 'Conductor did not hand the parcel over.',
            ])->assertOk();

        $this->forgetResolvedGuards();

        // Creation writes one event, the transition writes a second.
        $this->assertSame(2, \App\Models\DispatchEvent::where('dispatch_id', $dispatch->id)->count());
        $this->assertSame(2, $dispatch->fresh()->events()->count());

        $this->actingAs($this->webAdmin, 'web')
            ->get("/logistics/dispatches/{$dispatch->id}")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Logistics/DispatchDetail')
                ->where('dispatch.reference_no', 'OD0001')
                ->where('dispatch.status', 'not_received')
                ->where('dispatch.receipt_note', 'Conductor did not hand the parcel over.')
                ->has('dispatch.photos.bus', 2)
                ->has('dispatch.photos.package', 1)
                ->has('dispatch.events', 2)
            );
    }

    public function test_the_users_page_sends_stops_grouped_by_location_for_the_modal(): void
    {
        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/users')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Logistics/Users')
                ->has('users.data', 4)
                ->has('locations', 3)
                // Ranchi has two stops in the fixture; the modal needs them
                // without a second request when the location changes.
                ->has('stopsByLocation.' . $this->ranchi->id, 2)
                ->has('stopsByLocation.' . $this->gumla->id, 1)
            );
    }

    public function test_the_users_page_filters_by_role_and_location(): void
    {
        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/users?role=central')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('users.data', 2));

        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/users?location_id=' . $this->gumla->id)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('users.data', 1));
    }

    public function test_the_settings_page_defaults_to_the_central_location(): void
    {
        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/settings')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Logistics/Settings')
                ->has('locations', 3)
                ->where('selectedLocationId', $this->ranchi->id)
                ->has('stops', 2)
            );
    }

    public function test_the_settings_page_switches_the_selected_location(): void
    {
        $this->actingAs($this->webAdmin, 'web')
            ->get('/logistics/settings?location_id=' . $this->gumla->id)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('selectedLocationId', $this->gumla->id)
                ->has('stops', 1)
            );
    }

    public function test_the_panel_exposes_no_write_routes(): void
    {
        // Admins observe. Every mutation goes through the API, which enforces
        // the business rules; the panel itself must stay read-only.
        $writeRoutes = collect(Route::getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'logistics'))
            ->filter(fn ($route) => (bool) array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']))
            ->map(fn ($route) => implode('|', $route->methods()) . ' ' . $route->uri())
            ->values()
            ->all();

        $this->assertSame([], $writeRoutes, 'The logistics panel must expose read-only routes.');
    }
}
