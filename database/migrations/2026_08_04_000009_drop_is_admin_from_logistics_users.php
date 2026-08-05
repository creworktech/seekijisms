<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * There is one administrator identity, not two. Logistics is administered
 * from the web panel by a Service Management System user holding
 * users.manage, so a logistics account never needs an admin flag of its own.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics_users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
        });
    }

    public function down(): void
    {
        Schema::table('logistics_users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('is_central');
        });
    }
};
