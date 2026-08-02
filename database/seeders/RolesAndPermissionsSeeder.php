<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'customers.view',
            'customers.create',
            'customers.update',
            'customers.toggle',
            'jobs.view',
            'jobs.create',
            'jobs.transition',
            'jobs.deliver',
            'reports.view',
            'reports.export',
            'users.manage',
            'settings.manage',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        // 1. Admin Role
        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $adminRole->syncPermissions(Permission::all());

        // 2. Intake Coordinator Role
        $coordinatorRole = Role::firstOrCreate(['name' => 'intake_coordinator', 'guard_name' => 'web']);
        $coordinatorRole->syncPermissions([
            'customers.view',
            'customers.create',
            'customers.update',
            'customers.toggle',
            'jobs.view',
            'jobs.create',
            'jobs.deliver',
            'reports.view',
        ]);

        // 3. Tester Role
        $testerRole = Role::firstOrCreate(['name' => 'tester', 'guard_name' => 'web']);
        $testerRole->syncPermissions(['jobs.view']);

        // 4. Technician Role
        $technicianRole = Role::firstOrCreate(['name' => 'technician', 'guard_name' => 'web']);
        $technicianRole->syncPermissions(['jobs.view']);
    }
}
