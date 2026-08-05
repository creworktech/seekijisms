<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            AdminUserSeeder::class,
            SettingsSeeder::class,
            CounterSeeder::class,
            DemoDataSeeder::class,

            // Logistics module
            LogisticsCounterSeeder::class,
            LogisticsLocationSeeder::class,
            LogisticsStopSeeder::class,
            LogisticsUserSeeder::class,
            LogisticsDemoSeeder::class,
        ]);
    }
}
