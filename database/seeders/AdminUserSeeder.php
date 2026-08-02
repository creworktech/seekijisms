<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@seekoji.com'],
            [
                'name' => 'System Admin',
                'phone' => '9876543210',
                'password' => Hash::make('secret'),
                'is_active' => true,
            ]
        );
        $admin->assignRole('admin');

        $coordinator = User::firstOrCreate(
            ['email' => 'coordinator@seekoji.com'],
            [
                'name' => 'Intake Coordinator',
                'phone' => '9876543211',
                'password' => Hash::make('secret'),
                'is_active' => true,
            ]
        );
        $coordinator->assignRole('intake_coordinator');
    }
}
