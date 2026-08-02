<?php

namespace Database\Seeders;

use App\Models\Counter;
use Illuminate\Database\Seeder;

class CounterSeeder extends Seeder
{
    public function run(): void
    {
        Counter::updateOrCreate(['key' => 'job_token'], ['value' => 2850]);
        Counter::updateOrCreate(['key' => 'customer_code'], ['value' => 13]);
    }
}
