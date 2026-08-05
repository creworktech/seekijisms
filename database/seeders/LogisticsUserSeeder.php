<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\LogisticsUser;
use App\Models\Stop;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class LogisticsUserSeeder extends Seeder
{
    public function run(): void
    {
        // Field staff only. Logistics is administered from the web panel by a
        // Service Management System user, so there is no admin account here.
        $users = [
            // name,                 mobile,       location,     default stop,          central
            ['Roshan Lakra',         '7004308330', 'Ranchi',     'Khadgarha',           true],
            ['Ranchi Dispatch Desk', '9000000002', 'Ranchi',     'ITI Bus Stand',       true],
            ['Gumla Staff',          '9000000003', 'Gumla',      'Gumla Bus Stand',     false],
            ['Lohardaga Staff',      '9000000004', 'Lohardaga',  'Lohardaga Bus Stand', false],
            ['Simdega Staff',        '9000000005', 'Simdega',    'Simdega Bus Stand',   false],
        ];

        foreach ($users as [$name, $mobile, $locationName, $stopName, $isCentral]) {
            $location = Location::where('name', $locationName)->first();

            if (! $location) {
                continue;
            }

            $stop = Stop::where('location_id', $location->id)->where('name', $stopName)->first();

            LogisticsUser::updateOrCreate(
                ['mobile' => $mobile],
                [
                    'name' => $name,
                    'password' => Hash::make('secret'),
                    'location_id' => $location->id,
                    'default_stop_id' => $stop?->id,
                    'is_central' => $isCentral,
                    'is_active' => true,
                ]
            );
        }
    }
}
