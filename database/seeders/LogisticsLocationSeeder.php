<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Seeder;

class LogisticsLocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            ['name' => 'Ranchi', 'is_central' => true],
            ['name' => 'Gumla', 'is_central' => false],
            ['name' => 'Lohardaga', 'is_central' => false],
            ['name' => 'Simdega', 'is_central' => false],
        ];

        foreach ($locations as $location) {
            Location::updateOrCreate(
                ['name' => $location['name']],
                ['is_central' => $location['is_central'], 'is_active' => true]
            );
        }
    }
}
