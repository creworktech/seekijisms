<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'inspection_fee' => '250',
            'token_prefix' => 'SES',
            'customer_code_prefix' => 'ID',
            'business_name' => 'Seekoji Electric',
            'whatsapp_enabled' => '0',
        ];

        foreach ($defaults as $key => $value) {
            Setting::set($key, $value);
        }
    }
}
