<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Logistics WhatsApp messages are recorded in the same notification_logs
 * table the Service Management System already uses, so there is one place
 * to audit every outbound message.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->foreignId('dispatch_id')->nullable()->after('customer_id')
                ->constrained('dispatches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('dispatch_id');
        });
    }
};
