<?php

namespace Database\Seeders;

use App\Enums\DispatchStatus;
use App\Models\Counter;
use App\Models\Dispatch;
use App\Models\DispatchEvent;
use App\Models\LogisticsUser;
use App\Models\Stop;
use Illuminate\Database\Seeder;

/**
 * Local-only sample data: dispatches across all three statuses, in both
 * directions (spoke to hub and hub to spoke).
 */
class LogisticsDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        $hubUser = LogisticsUser::where('mobile', '7004308330')->first();
        $gumla = LogisticsUser::where('mobile', '9000000003')->first();
        $lohardaga = LogisticsUser::where('mobile', '9000000004')->first();

        if (! $hubUser || ! $gumla || ! $lohardaga) {
            return;
        }

        $rows = [
            // sender,      receiver,   status,                       item
            [$gumla,     $hubUser,   DispatchStatus::PENDING,      'Faulty ceiling fan motor'],
            [$gumla,     $hubUser,   DispatchStatus::RECEIVED,     'Burnt stabiliser unit'],
            [$lohardaga, $hubUser,    DispatchStatus::NOT_RECEIVED, 'Water pump control panel'],
            [$hubUser,   $gumla,     DispatchStatus::PENDING,      'Repaired inverter board'],
            [$hubUser,   $lohardaga, DispatchStatus::RECEIVED,     'Rewound submersible motor'],
        ];

        foreach ($rows as [$sender, $receiver, $status, $item]) {
            $this->makeDispatch($sender, $receiver, $status, $item);
        }
    }

    private function makeDispatch(
        LogisticsUser $sender,
        LogisticsUser $receiver,
        DispatchStatus $status,
        string $item
    ): void {
        $fromStop = Stop::where('location_id', $sender->location_id)->active()->first();
        $toStop = Stop::where('location_id', $receiver->location_id)->active()->first();

        if (! $fromStop || ! $toStop) {
            return;
        }

        $reference = $this->nextReference();

        if (Dispatch::where('reference_no', $reference)->exists()) {
            return;
        }

        $dispatch = Dispatch::create([
            'reference_no' => $reference,
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'from_stop_id' => $fromStop->id,
            'to_stop_id' => $toStop->id,
            'item_description' => $item,
            'quantity' => rand(1, 3),
            'bus_number' => 'JH01' . strtoupper(fake()->lexify('??')) . rand(1000, 9999),
            'driver_mobile' => '9' . rand(100000000, 999999999),
            'receiver_mobile' => $receiver->mobile,
            'bus_reach_time' => '10:00',
            'bus_leave_time' => '16:00',
            'status' => $status,
            'dispatch_date' => now()->subDays(rand(0, 6))->toDateString(),
            'received_at' => $status === DispatchStatus::PENDING ? null : now(),
            'received_by' => $status === DispatchStatus::PENDING ? null : $receiver->id,
            'receipt_note' => $status === DispatchStatus::NOT_RECEIVED
                ? 'Bus arrived but the parcel was not handed over by the conductor.'
                : null,
        ]);

        DispatchEvent::create([
            'dispatch_id' => $dispatch->id,
            'user_id' => $sender->id,
            'action' => 'created',
            'from_status' => null,
            'to_status' => DispatchStatus::PENDING->value,
            'note' => "Dispatch created by {$sender->name}.",
            'created_at' => $dispatch->created_at,
        ]);

        if ($status !== DispatchStatus::PENDING) {
            DispatchEvent::create([
                'dispatch_id' => $dispatch->id,
                'user_id' => $receiver->id,
                'action' => $status->value,
                'from_status' => DispatchStatus::PENDING->value,
                'to_status' => $status->value,
                'note' => $status === DispatchStatus::RECEIVED
                    ? "{$receiver->name} collected the package."
                    : "{$receiver->name} could not collect the package.",
                'created_at' => now(),
            ]);
        }
    }

    private function nextReference(): string
    {
        $counter = Counter::firstOrCreate(['key' => 'dispatch_ref'], ['value' => 0]);
        $counter->increment('value');

        return 'OD' . str_pad((string) $counter->fresh()->value, 4, '0', STR_PAD_LEFT);
    }
}
