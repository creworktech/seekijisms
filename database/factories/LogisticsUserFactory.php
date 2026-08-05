<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\LogisticsUser;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<LogisticsUser>
 */
class LogisticsUserFactory extends Factory
{
    protected $model = LogisticsUser::class;

    /** Guarantees distinct 10-digit mobiles even across large batches. */
    private static int $mobileSequence = 0;

    public function definition(): array
    {
        $mobile = '9' . str_pad((string) (++self::$mobileSequence), 9, '0', STR_PAD_LEFT);

        return [
            'name' => fake()->name(),
            'mobile' => $mobile,
            'password' => Hash::make('secret'),
            'location_id' => Location::factory(),
            'default_stop_id' => null,
            'is_central' => false,
            'is_active' => true,
        ];
    }

    public function central(): static
    {
        return $this->state(fn () => ['is_central' => true]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function at(Location $location): static
    {
        return $this->state(fn () => [
            'location_id' => $location->id,
            'is_central' => $location->is_central,
        ]);
    }
}
