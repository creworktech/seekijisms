<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Job;
use App\Models\JobEvent;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@seekoji.com')->first();
        $coordinator = User::where('email', 'coordinator@seekoji.com')->first();

        // Create Testers
        $tester1 = User::firstOrCreate(
            ['email' => 'tester1@seekoji.com'],
            ['name' => 'Amit Kumar (Tester)', 'phone' => '9876543221', 'password' => Hash::make('secret'), 'is_active' => true]
        );
        $tester1->assignRole('tester');

        $tester2 = User::firstOrCreate(
            ['email' => 'tester2@seekoji.com'],
            ['name' => 'Sanjay Verma (Tester)', 'phone' => '9876543222', 'password' => Hash::make('secret'), 'is_active' => true]
        );
        $tester2->assignRole('tester');

        // Create Technicians
        $tech1 = User::firstOrCreate(
            ['email' => 'tech1@seekoji.com'],
            ['name' => 'Ramesh Sharma (Technician)', 'phone' => '9876543231', 'password' => Hash::make('secret'), 'is_active' => true]
        );
        $tech1->assignRole('technician');

        $tech2 = User::firstOrCreate(
            ['email' => 'tech2@seekoji.com'],
            ['name' => 'Vikas Singh (Technician)', 'phone' => '9876543232', 'password' => Hash::make('secret'), 'is_active' => true]
        );
        $tech2->assignRole('technician');

        // 13 Customers (ID001 - ID013)
        $customersData = [
            ['name' => 'Rajesh Kumar', 'mobile' => '9876543001', 'address' => 'House 22, Kanke Road, Ranchi 834008'],
            ['name' => 'Priya Sharma', 'mobile' => '9876543002', 'address' => 'Flat 4A, Main Road, Ranchi 834001'],
            ['name' => 'Anil Prasad', 'mobile' => '9876543003', 'address' => 'Sector 2, Dhurwa, Ranchi 834004'],
            ['name' => 'Sunita Devi', 'mobile' => '9876543004', 'address' => 'Lalpur Chowk, Ranchi 834001'],
            ['name' => 'Manoj Singh', 'mobile' => '9876543005', 'address' => 'Bariatu Road, Ranchi 834009'],
            ['name' => 'Kavita Roy', 'mobile' => '9876543006', 'address' => 'Harmu Housing Board, Ranchi 834002'],
            ['name' => 'Deepak Verma', 'mobile' => '9876543007', 'address' => 'Doranda Market, Ranchi 834002'],
            ['name' => 'Suman Gupta', 'mobile' => '9876543008', 'address' => 'Ratu Road, Ranchi 834005'],
            ['name' => 'Alok Nath', 'mobile' => '9876543009', 'address' => 'Namkum Industrial Area, Ranchi 834010'],
            ['name' => 'Pooja Mishra', 'mobile' => '9876543010', 'address' => 'Kokar Chowk, Ranchi 834001'],
            ['name' => 'Vikram Aditya', 'mobile' => '9876543011', 'address' => 'Tupudana, Ranchi 834003'],
            ['name' => 'Neha Agarwal', 'mobile' => '9876543012', 'address' => 'Ashok Nagar, Ranchi 834002'],
            ['name' => 'Rohan Sen', 'mobile' => '9876543013', 'address' => 'Morabadi, Ranchi 834008'],
        ];

        $customers = [];
        foreach ($customersData as $idx => $c) {
            $code = 'ID' . str_pad((string)($idx + 1), 3, '0', STR_PAD_LEFT);
            $customers[] = Customer::firstOrCreate(
                ['customer_code' => $code],
                [
                    'name' => $c['name'],
                    'mobile' => $c['mobile'],
                    'address' => $c['address'],
                    'is_active' => true,
                    'registered_on' => Carbon::today()->subDays(30 - $idx)->format('Y-m-d'),
                    'created_by' => $coordinator->id,
                ]
            );
        }

        // 14 Jobs across all 8 stages
        $jobsSeedData = [
            // 1. Stage: new
            [
                'token_no' => 'TKN-2837', 'customer_id' => $customers[0]->id,
                'product_name' => 'Voltage Stabilizer 5KVA', 'brand' => 'V-Guard', 'serial_no' => 'SN82931',
                'power_rating' => '5KVA', 'fault_description' => 'Output voltage fluctuating, clicking sound.',
                'received_from' => 'bus', 'priority' => 'high', 'stage' => 'new', 'outcome' => null,
            ],
            // 2. Stage: new
            [
                'token_no' => 'TKN-2838', 'customer_id' => $customers[1]->id,
                'product_name' => 'Submersible Pump Controller', 'brand' => 'Crompton', 'serial_no' => 'CR99182',
                'power_rating' => '2HP', 'fault_description' => 'Motor not starting, green light blinking.',
                'received_from' => 'self', 'priority' => 'medium', 'stage' => 'new', 'outcome' => null,
            ],
            // 3. Stage: testing
            [
                'token_no' => 'TKN-2839', 'customer_id' => $customers[2]->id,
                'product_name' => 'Pure Sine Wave Inverter', 'brand' => 'Microtek', 'serial_no' => 'MT77361',
                'power_rating' => '1000VA', 'fault_description' => 'Overload alarm continuously buzzing.',
                'received_from' => 'courier', 'priority' => 'high', 'stage' => 'testing', 'outcome' => null,
                'tester_id' => $tester1->id,
            ],
            // 4. Stage: testing
            [
                'token_no' => 'TKN-2840', 'customer_id' => $customers[3]->id,
                'product_name' => 'Digital Solar Charge Controller', 'brand' => 'Luminous', 'serial_no' => 'LM55201',
                'power_rating' => '40A', 'fault_description' => 'Battery charging indicator not glowing.',
                'received_from' => 'self', 'priority' => 'low', 'stage' => 'testing', 'outcome' => null,
                'tester_id' => $tester2->id,
            ],
            // 5. Stage: approval
            [
                'token_no' => 'TKN-2841', 'customer_id' => $customers[4]->id,
                'product_name' => 'Industrial Induction Motor', 'brand' => 'Havells', 'serial_no' => 'HV99210',
                'power_rating' => '5HP', 'fault_description' => 'Smoke coming out during heavy load operation.',
                'received_from' => 'bus', 'priority' => 'high', 'stage' => 'approval', 'outcome' => null,
                'tester_id' => $tester1->id, 'tester_findings' => 'Stator winding burnt out, needs rewinding.',
                'estimated_budget' => 4500.00,
            ],
            // 6. Stage: approval
            [
                'token_no' => 'TKN-2842', 'customer_id' => $customers[5]->id,
                'product_name' => 'Online UPS 3KVA', 'brand' => 'APC', 'serial_no' => 'APC1029',
                'power_rating' => '3KVA', 'fault_description' => 'Battery backup not sustaining load.',
                'received_from' => 'self', 'priority' => 'medium', 'stage' => 'approval', 'outcome' => null,
                'tester_id' => $tester2->id, 'tester_findings' => 'DC capacitor bank damaged.',
                'estimated_budget' => 2800.00,
            ],
            // 7. Stage: repair
            [
                'token_no' => 'TKN-2843', 'customer_id' => $customers[6]->id,
                'product_name' => 'Heavy Duty Transformer 10KVA', 'brand' => 'Servokon', 'serial_no' => 'SK4401',
                'power_rating' => '10KVA', 'fault_description' => 'High voltage output tripping main breaker.',
                'received_from' => 'bus', 'priority' => 'high', 'stage' => 'repair', 'outcome' => null,
                'tester_id' => $tester1->id, 'technician_id' => $tech1->id,
                'tester_findings' => 'Servo motor driver IC shorted.',
                'estimated_budget' => 6000.00, 'approved_amount' => 5800.00,
            ],
            // 8. Stage: repair
            [
                'token_no' => 'TKN-2844', 'customer_id' => $customers[7]->id,
                'product_name' => 'Automatic Voltage Regulator', 'brand' => 'V-Guard', 'serial_no' => 'VG3301',
                'power_rating' => '3KVA', 'fault_description' => 'Cutoff voltage sensor failing.',
                'received_from' => 'self', 'priority' => 'medium', 'stage' => 'repair', 'outcome' => null,
                'tester_id' => $tester2->id, 'technician_id' => $tech2->id,
                'estimated_budget' => 1500.00, 'approved_amount' => 1500.00,
            ],
            // 9. Stage: pending
            [
                'token_no' => 'TKN-2845', 'customer_id' => $customers[8]->id,
                'product_name' => 'Variable Frequency Drive VFD', 'brand' => 'Delta', 'serial_no' => 'DL9901',
                'power_rating' => '7.5HP', 'fault_description' => 'Display showing Err04 output phase loss.',
                'received_from' => 'courier', 'priority' => 'high', 'stage' => 'pending', 'outcome' => null,
                'tester_id' => $tester1->id, 'technician_id' => $tech1->id,
                'estimated_budget' => 8500.00, 'approved_amount' => 8500.00,
                'pend_reason' => 'IGBT module replacement part out of stock, waiting for delivery.',
            ],
            // 10. Stage: completed (outcome: work_done)
            [
                'token_no' => 'TKN-2846', 'customer_id' => $customers[9]->id,
                'product_name' => 'Submersible Pump Control Box', 'brand' => 'Kirloskar', 'serial_no' => 'KL1092',
                'power_rating' => '1.5HP', 'fault_description' => 'Contactor chattering noise.',
                'received_from' => 'self', 'priority' => 'medium', 'stage' => 'completed', 'outcome' => 'work_done',
                'tester_id' => $tester2->id, 'technician_id' => $tech2->id,
                'estimated_budget' => 1200.00, 'approved_amount' => 1200.00, 'final_amount' => 1200.00,
                'payable_amount' => 1200.00, 'is_paid' => false,
            ],
            // 11. Stage: completed (outcome: not_repairable)
            [
                'token_no' => 'TKN-2847', 'customer_id' => $customers[10]->id,
                'product_name' => 'Old Model Inverter', 'brand' => 'Su-Kam', 'serial_no' => 'SK0091',
                'power_rating' => '800VA', 'fault_description' => 'Burnt smell during charging.',
                'received_from' => 'self', 'priority' => 'low', 'stage' => 'completed', 'outcome' => 'not_repairable',
                'tester_id' => $tester1->id, 'tester_findings' => 'Main PCB board charred beyond repair.',
                'payable_amount' => 250.00, 'is_paid' => false,
            ],
            // 12. Stage: completed (outcome: cancelled)
            [
                'token_no' => 'TKN-2848', 'customer_id' => $customers[11]->id,
                'product_name' => 'Solar Inverter 2KVA', 'brand' => 'UTL', 'serial_no' => 'UTL449',
                'power_rating' => '2KVA', 'fault_description' => 'No AC output.',
                'received_from' => 'bus', 'priority' => 'medium', 'stage' => 'completed', 'outcome' => 'cancelled',
                'payable_amount' => 250.00, 'is_paid' => false,
            ],
            // 13. Stage: ready
            [
                'token_no' => 'TKN-2849', 'customer_id' => $customers[12]->id,
                'product_name' => 'Home Stabilizer 4KVA', 'brand' => 'V-Guard', 'serial_no' => 'VG9001',
                'power_rating' => '4KVA', 'fault_description' => 'High voltage cutoff relay stuck.',
                'received_from' => 'self', 'priority' => 'medium', 'stage' => 'ready', 'outcome' => 'work_done',
                'tester_id' => $tester2->id, 'technician_id' => $tech1->id,
                'final_amount' => 1850.00, 'payable_amount' => 1850.00,
                'is_paid' => true, 'payment_mode' => 'upi', 'paid_at' => now()->subHours(2),
            ],
            // 14. Stage: delivered
            [
                'token_no' => 'TKN-2850', 'customer_id' => $customers[0]->id,
                'product_name' => 'Exide Inverter 1050VA', 'brand' => 'Exide', 'serial_no' => 'EX7710',
                'power_rating' => '1050VA', 'fault_description' => 'Fuse blowing repeatedly.',
                'received_from' => 'self', 'priority' => 'high', 'stage' => 'delivered', 'outcome' => 'work_done',
                'tester_id' => $tester1->id, 'technician_id' => $tech2->id,
                'final_amount' => 2400.00, 'payable_amount' => 2400.00,
                'is_paid' => true, 'payment_mode' => 'cash', 'paid_at' => now()->subDays(1),
                'delivery_mode' => 'self', 'delivery_receiver' => 'Rajesh Kumar', 'out_date' => Carbon::today(),
            ],
        ];

        foreach ($jobsSeedData as $jData) {
            $jData['in_date'] = Carbon::today()->subDays(10)->format('Y-m-d');
            $jData['created_by'] = $coordinator->id;

            $job = Job::firstOrCreate(['token_no' => $jData['token_no']], $jData);

            JobEvent::firstOrCreate(
                [
                    'job_id' => $job->id,
                    'action' => 'job_created',
                ],
                [
                    'user_id' => $coordinator->id,
                    'from_stage' => null,
                    'to_stage' => $job->stage,
                    'note' => "Job created with token {$job->token_no}.",
                    'created_at' => now()->subDays(10),
                ]
            );
        }
    }
}
