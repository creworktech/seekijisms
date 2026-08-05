<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Stop;
use Illuminate\Database\Seeder;

class LogisticsStopSeeder extends Seeder
{
    public function run(): void
    {
        $stopsByLocation = [
            'Ranchi' => ['Khadgarha', 'ITI Bus Stand', 'Govt Bus Stand', 'Booty More'],
            'Gumla' => ['Gumla Bus Stand', 'Sisai Road'],
            'Lohardaga' => ['Lohardaga Bus Stand'],
            'Simdega' => ['Simdega Bus Stand'],
        ];

        foreach ($stopsByLocation as $locationName => $stops) {
            $location = Location::where('name', $locationName)->first();

            if (! $location) {
                continue;
            }

            foreach ($stops as $stopName) {
                Stop::updateOrCreate(
                    ['location_id' => $location->id, 'name' => $stopName],
                    ['is_active' => true]
                );
            }
        }
    }
}
