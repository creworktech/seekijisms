<?php

namespace Tests\Feature\Logistics;

use App\Models\Counter;
use App\Models\Dispatch;
use App\Services\DispatchService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

/**
 * Reference numbers must never collide. The counter is read under
 * lockForUpdate inside the creating transaction, and the column carries a
 * UNIQUE index as the last line of defence.
 */
class DispatchReferenceTest extends LogisticsTestCase
{
    public function test_fifty_dispatches_all_receive_distinct_sequential_references(): void
    {
        Queue::fake();

        $service = app(DispatchService::class);

        $payload = [
            'receiver_id' => $this->hubUser->id,
            'from_stop_id' => $this->gumlaStand->id,
            'to_stop_id' => $this->khadgarha->id,
            'quantity' => 1,
            'bus_reach_time' => '10:00',
        ];

        for ($i = 0; $i < 50; $i++) {
            $service->create($payload, $this->gumlaUser);
        }

        $references = Dispatch::orderBy('id')->pluck('reference_no');

        $this->assertCount(50, $references);
        $this->assertCount(50, $references->unique(), 'Every reference number must be distinct.');
        $this->assertSame('OD0001', $references->first());
        $this->assertSame('OD0050', $references->last());

        // No gaps: the sequence is exactly OD0001..OD0050.
        $expected = collect(range(1, 50))
            ->map(fn ($n) => 'OD' . str_pad((string) $n, 4, '0', STR_PAD_LEFT));

        $this->assertSame($expected->all(), $references->all());
        $this->assertSame(50, (int) Counter::where('key', 'dispatch_ref')->value('value'));
    }

    public function test_the_database_rejects_a_duplicate_reference_number(): void
    {
        // The application logic is one guard; the UNIQUE index is the other.
        // If the counter were ever bypassed, the insert must still fail.
        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create(['reference_no' => 'OD9999']);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        Dispatch::factory()->between($this->gumlaUser, $this->hubUser)->create(['reference_no' => 'OD9999']);
    }

    public function test_the_counter_survives_a_rolled_back_transaction_without_reusing_a_reference(): void
    {
        Queue::fake();

        $service = app(DispatchService::class);

        $payload = [
            'receiver_id' => $this->hubUser->id,
            'from_stop_id' => $this->gumlaStand->id,
            'to_stop_id' => $this->khadgarha->id,
            'quantity' => 1,
            'bus_reach_time' => '10:00',
        ];

        $first = $service->create($payload, $this->gumlaUser);
        $this->assertSame('OD0001', $first->reference_no);

        // A caller-level rollback discards the dispatch. The counter is not
        // rewound, so the next reference moves on rather than being reissued.
        try {
            DB::transaction(function () use ($service, $payload) {
                $service->create($payload, $this->gumlaUser);

                throw new \RuntimeException('caller aborts after creating');
            });
        } catch (\RuntimeException) {
            // expected
        }

        $third = $service->create($payload, $this->gumlaUser);

        $this->assertNotSame('OD0001', $third->reference_no);
        $this->assertSame(1, Dispatch::where('reference_no', 'OD0001')->count());
        $this->assertSame(
            0,
            Dispatch::select('reference_no')
                ->groupBy('reference_no')
                ->havingRaw('COUNT(*) > 1')
                ->get()
                ->count(),
            'No reference number may ever appear twice.'
        );
    }

    public function test_references_keep_their_four_digit_padding_past_one_thousand(): void
    {
        Queue::fake();

        Counter::where('key', 'dispatch_ref')->update(['value' => 1234]);

        $dispatch = app(DispatchService::class)->create([
            'receiver_id' => $this->hubUser->id,
            'from_stop_id' => $this->gumlaStand->id,
            'to_stop_id' => $this->khadgarha->id,
            'quantity' => 1,
            'bus_reach_time' => '10:00',
        ], $this->gumlaUser);

        $this->assertSame('OD1235', $dispatch->reference_no);
    }
}
