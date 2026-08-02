<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('token_no', 16)->unique();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->string('product_name', 160);
            $table->string('brand', 80)->nullable();
            $table->string('serial_no', 80)->nullable();
            $table->string('power_rating', 40)->nullable();
            $table->text('fault_description');
            $table->text('customer_remark')->nullable();
            $table->enum('received_from', ['bus', 'self', 'courier']);
            $table->enum('priority', ['high', 'medium', 'low'])->default('medium')->index();
            $table->enum('stage', [
                'new', 'testing', 'approval', 'repair',
                'pending', 'completed', 'ready', 'delivered'
            ])->index();
            $table->enum('outcome', [
                'ok_no_fault', 'work_done', 'not_repairable',
                'not_approved', 'cancelled'
            ])->nullable();
            $table->foreignId('tester_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('tester_findings')->nullable();
            $table->decimal('estimated_budget', 10, 2)->nullable();
            $table->decimal('approved_amount', 10, 2)->nullable();
            $table->decimal('final_amount', 10, 2)->nullable();
            $table->decimal('payable_amount', 10, 2)->nullable();
            $table->boolean('is_paid')->default(false);
            $table->enum('payment_mode', ['cash', 'upi', 'bank', 'waived'])->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('pend_reason', 255)->nullable();
            $table->enum('delivery_mode', ['bus', 'courier', 'self'])->nullable();
            $table->string('delivery_receiver', 120)->nullable();
            $table->string('delivery_ref', 80)->nullable();
            $table->date('in_date')->index();
            $table->date('out_date')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['stage', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jobs');
    }
};
