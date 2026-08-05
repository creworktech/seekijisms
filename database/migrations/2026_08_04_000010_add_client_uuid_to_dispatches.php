<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency key for the mobile offline queue.
 *
 * The app generates one UUID when a dispatch is queued and reuses it on every
 * retry. If a response is lost after the server already committed, the retry
 * carries the same key and is answered with the original dispatch instead of
 * creating a second parcel. The UNIQUE index is the real guard — two
 * simultaneous retries race, and one of them must lose.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatches', function (Blueprint $table) {
            $table->char('client_uuid', 36)->nullable()->unique()->after('reference_no');
        });
    }

    public function down(): void
    {
        Schema::table('dispatches', function (Blueprint $table) {
            $table->dropUnique(['client_uuid']);
            $table->dropColumn('client_uuid');
        });
    }
};
