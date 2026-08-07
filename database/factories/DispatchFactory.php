<?php

namespace Database\Factories;

use App\Enums\DispatchStatus;
use App\Models\Dispatch;
use App\Models\LogisticsUser;
use App\Models\Stop;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Dispatch>
 */
class DispatchFactory extends Factory
{
    protected $model = Dispatch::class;

    /** Reference numbers are normally issued by CounterService; factories need their own run. */
    private static int $refSequence = 0;

    public function definition(): array
    {
        return [
            'reference_no' => 'OD' . str_pad((string) (++self::$refSequence), 4, '0', STR_PAD_LEFT),
            'sender_id' => LogisticsUser::factory(),
            'receiver_id' => LogisticsUser::factory(),
            'from_stop_id' => Stop::factory(),
            'to_stop_id' => Stop::factory(),
            'quantity' => fake()->numberBetween(1, 5),
            'driver_mobile' => '9' . fake()->numerify('#########'),
            'bus_reach_time' => '10:00',
            'status' => DispatchStatus::PENDING,
            'dispatch_date' => now()->toDateString(),
        ];
    }

    public function received(?LogisticsUser $by = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DispatchStatus::RECEIVED,
            'received_at' => now(),
            'received_by' => $by?->id ?? $attributes['receiver_id'],
        ]);
    }

    public function notReceived(string $reason = 'Bus did not arrive at the stand.'): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DispatchStatus::NOT_RECEIVED,
            'received_at' => now(),
            'received_by' => $attributes['receiver_id'],
            'receipt_note' => $reason,
        ]);
    }

    /**
     * Wires a consistent sender/receiver pair with stops that satisfy
     * business rules 4 and 5 (stops must belong to the matching location).
     */
    public function between(LogisticsUser $sender, LogisticsUser $receiver): static
    {
        return $this->state(fn () => [
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'from_stop_id' => Stop::factory()->create(['location_id' => $sender->location_id])->id,
            'to_stop_id' => Stop::factory()->create(['location_id' => $receiver->location_id])->id,
        ]);
    }
}
