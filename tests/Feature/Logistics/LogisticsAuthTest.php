<?php

namespace Tests\Feature\Logistics;

use App\Models\Dispatch;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Support\Facades\Route;

/**
 * Business rules 3 and 9, plus the boundary between the two identity systems:
 * a Service Management System account and a logistics account must never be
 * able to use each other's tokens.
 */
class LogisticsAuthTest extends LogisticsTestCase
{
    // Rule 9 — deactivated users cannot authenticate.

    public function test_a_deactivated_user_cannot_log_in(): void
    {
        $this->gumlaUser->update(['is_active' => false]);

        $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'secret',
        ])->assertForbidden();
    }

    public function test_a_wrong_password_is_rejected(): void
    {
        $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'not-the-password',
        ])->assertStatus(422)->assertJsonValidationErrors('mobile');
    }

    public function test_an_unknown_mobile_is_rejected(): void
    {
        $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => '9999999999',
            'password' => 'secret',
        ])->assertStatus(422)->assertJsonValidationErrors('mobile');
    }

    public function test_the_mobile_number_must_be_ten_digits(): void
    {
        $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => '12345',
            'password' => 'secret',
        ])->assertStatus(422)->assertJsonValidationErrors('mobile');
    }

    public function test_deactivating_a_user_invalidates_their_existing_token(): void
    {
        $token = $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'secret',
        ])->json('data.token');

        $this->withToken($token)->getJson($this->apiUrl('auth/me'))->assertOk();

        // An admin switching the account off must end the session immediately.
        // The logistics guard is already holding the user resolved from the
        // token above; clear it so the admin call is judged as the web user.
        $this->forgetResolvedGuards();

        $this->actingAs($this->webAdmin(), 'web')
            ->patchJson('/api/v1/logistics/admin/users/' . $this->gumlaUser->id . '/toggle-status')
            ->assertOk();

        $this->forgetResolvedGuards();
        $this->withToken($token)->getJson($this->apiUrl('auth/me'))->assertUnauthorized();
    }

    public function test_logout_revokes_the_token(): void
    {
        $token = $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'secret',
        ])->json('data.token');

        $this->withToken($token)->postJson($this->apiUrl('auth/logout'))->assertOk();

        $this->forgetResolvedGuards();
        $this->withToken($token)->getJson($this->apiUrl('auth/me'))->assertUnauthorized();
    }

    // Guard isolation

    public function test_a_service_management_token_cannot_reach_the_logistics_api(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $webUser = User::factory()->create(['is_active' => true]);
        $webUser->assignRole('admin');

        $token = $webUser->createToken('sms-token')->plainTextToken;

        $this->withToken($token)->getJson($this->apiUrl('bootstrap'))->assertUnauthorized();
        $this->withToken($token)->getJson($this->apiUrl('dispatches/sent'))->assertUnauthorized();
    }

    public function test_a_logistics_token_cannot_reach_the_service_management_api(): void
    {
        $token = $this->postJson($this->apiUrl('auth/login'), [
            'mobile' => $this->gumlaUser->mobile,
            'password' => 'secret',
        ])->json('data.token');

        // These Service Management endpoints carry no `can:` permission gate,
        // so the auth guard is the only thing standing between a logistics
        // token and this data. Regression cover for exactly that.
        foreach ([
            '/api/v1/dashboard/stats',
            '/api/v1/dashboard/recent-jobs',
            '/api/v1/settings',
            '/api/v1/jobs/token-preview',
            '/api/v1/auth/me',
            '/api/v1/jobs',
            '/api/v1/customers',
        ] as $uri) {
            $this->forgetResolvedGuards();

            $this->assertSame(
                401,
                $this->withToken($token)->getJson($uri)->getStatusCode(),
                "A logistics token must not authenticate against {$uri}."
            );
        }
    }

    // Rule 14 — non-admins get 403 on every admin route.

    public function test_a_non_admin_is_refused_on_every_logistics_admin_route(): void
    {
        // Route-model binding is substituted before the authorisation
        // middleware runs, so every id in the URL must resolve — otherwise a
        // 404 would masquerade as a passing authorisation check.
        $dispatch = Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create();

        $adminRoutes = collect(Route::getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v1/logistics/admin'))
            ->values();

        $this->assertGreaterThan(0, $adminRoutes->count(), 'Expected logistics admin routes to exist.');

        foreach ($adminRoutes as $route) {
            $method = collect($route->methods())->first(fn ($m) => $m !== 'HEAD');

            $uri = '/' . str_replace(
                ['{dispatch}', '{logisticsUser}', '{location}', '{stop}'],
                [
                    (string) $dispatch->id,
                    (string) $this->gumlaUser->id,
                    (string) $this->gumla->id,
                    (string) $this->gumlaStand->id,
                ],
                $route->uri()
            );

            $response = $this->actingAs($this->gumlaUser, 'logistics')
                ->json($method, $uri);

            $this->assertSame(
                403,
                $response->getStatusCode(),
                "Expected 403 for a non-admin on {$method} {$uri}, got {$response->getStatusCode()}."
            );
        }
    }

    public function test_no_logistics_account_can_reach_the_admin_api(): void
    {
        // Administration lives entirely in the web panel. Even a central hub
        // user at Ranchi is field staff as far as the admin surface goes.
        foreach ([$this->gumlaUser, $this->hubUser, $this->hubColleague] as $user) {
            $this->actingAs($user, 'logistics')
                ->getJson('/api/v1/logistics/admin/dashboard/stats')
                ->assertForbidden();
        }
    }

    public function test_a_service_management_web_admin_can_reach_the_admin_api_by_session(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $webAdmin = User::factory()->create(['is_active' => true]);
        $webAdmin->assignRole('admin');

        $this->actingAs($webAdmin, 'web')
            ->getJson('/api/v1/logistics/admin/dashboard/stats')
            ->assertOk();
    }

    public function test_a_service_management_user_without_manage_permission_is_refused(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $tester = User::factory()->create(['is_active' => true]);
        $tester->assignRole('tester');

        $this->actingAs($tester, 'web')
            ->getJson('/api/v1/logistics/admin/dashboard/stats')
            ->assertForbidden();
    }
}
