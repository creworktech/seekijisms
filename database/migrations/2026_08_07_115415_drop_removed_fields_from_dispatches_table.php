<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Client-approved removal: item description, bus number, bus out time,
 * alternate (receiver) contact number, and remarks are no longer collected
 * on a dispatch.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatches', function (Blueprint $table) {
            $table->dropColumn([
                'item_description',
                'bus_number',
                'bus_leave_time',
                'receiver_mobile',
                'remarks',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('dispatches', function (Blueprint $table) {
            $table->string('item_description', 255)->nullable();
            $table->string('bus_number', 30)->nullable();
            $table->time('bus_leave_time')->nullable();
            $table->string('receiver_mobile', 10)->nullable();
            $table->text('remarks')->nullable();
        });
    }
};
