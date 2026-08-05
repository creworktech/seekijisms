<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Logistics notifications go out over WhatsApp, reusing the Service
 * Management System's Meta integration, so there is no device token to keep.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics_users', function (Blueprint $table) {
            $table->dropColumn('fcm_token');
        });
    }

    public function down(): void
    {
        Schema::table('logistics_users', function (Blueprint $table) {
            $table->string('fcm_token', 255)->nullable()->after('is_active');
        });
    }
};
