<?php

namespace Database\Seeders;

use App\Models\Counter;
use Illuminate\Database\Seeder;

/**
 * Seeds only the logistics dispatch reference counter.
 *
 * Deliberately separate from CounterSeeder: that one rewrites the Service
 * Management System's job_token and customer_code counters to fixed demo
 * values, so running it to obtain dispatch_ref would clobber live SMS
 * numbering. firstOrCreate here, never updateOrCreate — re-seeding must
 * never rewind a counter that has already issued references.
 */
class LogisticsCounterSeeder extends Seeder
{
    public function run(): void
    {
        Counter::firstOrCreate(['key' => 'dispatch_ref'], ['value' => 0]);
    }
}
