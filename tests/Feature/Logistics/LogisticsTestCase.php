<?php

namespace Tests\Feature\Logistics;

use App\Models\Counter;
use App\Models\Location;
use App\Models\LogisticsUser;
use App\Models\Stop;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Shared hub-and-spoke fixture: Ranchi as the central hub with two users,
 * Gumla and Lohardaga as spokes with one each.
 */
abstract class LogisticsTestCase extends TestCase
{
    use RefreshDatabase;

    protected Location $ranchi;
    protected Location $gumla;
    protected Location $lohardaga;

    protected Stop $khadgarha;
    protected Stop $itiStand;
    protected Stop $gumlaStand;
    protected Stop $lohardagaStand;

    protected LogisticsUser $hubUser;
    protected LogisticsUser $hubColleague;
    protected LogisticsUser $gumlaUser;
    protected LogisticsUser $lohardagaUser;

    private ?User $webAdminInstance = null;

    protected function setUp(): void
    {
        parent::setUp();

        // These are API endpoints. Without an explicit Accept header a
        // multipart POST is treated as a browser form, so validation failures
        // come back as a 302 redirect instead of a 422 JSON body.
        $this->withHeader('Accept', 'application/json');

        Storage::fake('local');

        Counter::firstOrCreate(['key' => 'dispatch_ref'], ['value' => 0]);

        $this->ranchi = Location::factory()->central()->create(['name' => 'Ranchi']);
        $this->gumla = Location::factory()->create(['name' => 'Gumla']);
        $this->lohardaga = Location::factory()->create(['name' => 'Lohardaga']);

        $this->khadgarha = Stop::factory()->create(['location_id' => $this->ranchi->id, 'name' => 'Khadgarha']);
        $this->itiStand = Stop::factory()->create(['location_id' => $this->ranchi->id, 'name' => 'ITI Bus Stand']);
        $this->gumlaStand = Stop::factory()->create(['location_id' => $this->gumla->id, 'name' => 'Gumla Bus Stand']);
        $this->lohardagaStand = Stop::factory()->create(['location_id' => $this->lohardaga->id, 'name' => 'Lohardaga Bus Stand']);

        $this->hubUser = LogisticsUser::factory()->central()->create([
            'location_id' => $this->ranchi->id,
            'default_stop_id' => $this->khadgarha->id,
            'name' => 'Roshan Lakra',
        ]);

        $this->hubColleague = LogisticsUser::factory()->central()->create([
            'location_id' => $this->ranchi->id,
            'default_stop_id' => $this->itiStand->id,
            'name' => 'Ranchi Colleague',
        ]);

        $this->gumlaUser = LogisticsUser::factory()->create([
            'location_id' => $this->gumla->id,
            'default_stop_id' => $this->gumlaStand->id,
            'name' => 'Gumla Staff',
        ]);

        $this->lohardagaUser = LogisticsUser::factory()->create([
            'location_id' => $this->lohardaga->id,
            'default_stop_id' => $this->lohardagaStand->id,
            'name' => 'Lohardaga Staff',
        ]);

    }

    /**
     * The administrator is a Service Management System web user holding
     * users.manage — logistics accounts are field staff and never administer
     * anything, so there is no logistics admin to act as.
     */
    protected function webAdmin(): User
    {
        if (! isset($this->webAdminInstance)) {
            $this->seed(RolesAndPermissionsSeeder::class);

            $this->webAdminInstance = User::factory()->create([
                'is_active' => true,
                'name' => 'System Admin',
                'phone' => '9812340000',
            ]);

            $this->webAdminInstance->assignRole('admin');
        }

        return $this->webAdminInstance;
    }

    /**
     * A fake JPEG upload.
     *
     * Built with create() rather than image() on purpose: image() renders a
     * real bitmap through GD, which is not guaranteed to be enabled on a dev
     * box or in CI. The validator only inspects the mime type, so this
     * exercises the same rules without the extension.
     */
    protected function photo(string $name = 'photo.jpg', int $kilobytes = 500): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kilobytes, 'image/jpeg');
    }

    /**
     * A valid spoke-to-hub creation payload.
     *
     * @return array<string, mixed>
     */
    protected function validDispatchPayload(array $overrides = []): array
    {
        return array_merge([
            'receiver_id' => $this->hubUser->id,
            'from_stop_id' => $this->gumlaStand->id,
            'to_stop_id' => $this->khadgarha->id,
            'item_description' => 'Faulty ceiling fan motor',
            'quantity' => 2,
            'bus_number' => 'jh01ab1234',
            'driver_mobile' => '9876543210',
            'receiver_mobile' => '9876543211',
            'bus_reach_time' => '10:00',
            'bus_leave_time' => '16:00',
            'remarks' => 'Handle with care',
            'bus_photos' => [$this->photo('bus.jpg')],
            'package_photos' => [$this->photo('package.jpg')],
        ], $overrides);
    }

    protected function apiUrl(string $path): string
    {
        return '/api/v1/logistics/' . ltrim($path, '/');
    }

    /**
     * Drops any guard instance already resolved in this test.
     *
     * The application is not rebooted between requests in a feature test, so
     * a guard that has authenticated once keeps returning that user. Anything
     * asserting a token stopped working has to clear it first, or it would
     * pass against a stale in-memory user rather than the database.
     */
    protected function forgetResolvedGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
