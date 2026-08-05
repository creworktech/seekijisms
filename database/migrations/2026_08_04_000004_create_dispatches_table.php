<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatches', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 16)->unique();   // OD0001, OD0002...

            $table->foreignId('sender_id')->constrained('logistics_users')->restrictOnDelete();
            $table->foreignId('receiver_id')->constrained('logistics_users')->restrictOnDelete();
            $table->foreignId('from_stop_id')->constrained('stops')->restrictOnDelete();
            $table->foreignId('to_stop_id')->constrained('stops')->restrictOnDelete();

            $table->string('item_description', 255);
            $table->unsignedInteger('quantity');
            $table->string('bus_number', 30);
            $table->string('driver_mobile', 10)->nullable();
            $table->string('receiver_mobile', 10)->nullable();
            $table->time('bus_reach_time');
            $table->time('bus_leave_time');
            $table->text('remarks')->nullable();

            $table->enum('status', ['pending', 'received', 'not_received'])->default('pending');

            $table->timestamp('received_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('logistics_users')->nullOnDelete();
            $table->string('receipt_note', 500)->nullable();   // reason when not_received
            $table->decimal('receipt_latitude', 10, 7)->nullable();
            $table->decimal('receipt_longitude', 10, 7)->nullable();

            $table->date('dispatch_date');
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('sender_id');
            $table->index('receiver_id');
            $table->index('dispatch_date');
            $table->index(['receiver_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatches');
    }
};
