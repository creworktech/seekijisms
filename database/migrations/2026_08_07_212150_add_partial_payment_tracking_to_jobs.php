<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Client requirement: part payments, with the balance still due tracked
 * properly. `payable_amount` was previously doing double duty — the bill,
 * then silently overwritten with whatever was collected — which had no room
 * for "collected some, still owes some". `paid_amount` is the running total
 * actually collected; `payable_amount` goes back to meaning only the bill.
 *
 * Purely additive: one new nullable-safe column with a default, one new
 * table. Nothing existing is dropped, renamed, or overwritten, so this is
 * safe to run against production data as-is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->decimal('paid_amount', 10, 2)->default(0)->after('payable_amount');
        });

        // Backfill from the existing is_paid flag. Before this migration,
        // collect_payment overwrote payable_amount with whatever was
        // actually collected, so for a row already marked paid, the value
        // sitting in payable_amount right now IS the amount that was
        // collected — safe to copy it into paid_amount as-is. Unpaid rows
        // keep the column default of 0, since nothing has been collected.
        DB::table('jobs')
            ->where('is_paid', true)
            ->whereNotNull('payable_amount')
            ->update(['paid_amount' => DB::raw('payable_amount')]);

        Schema::create('job_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained('jobs')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->enum('payment_mode', ['cash', 'upi', 'bank', 'waived']);
            $table->string('remarks', 500)->nullable();
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('collected_at');
            $table->timestamps();

            $table->index(['job_id', 'collected_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_payments');

        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn('paid_amount');
        });
    }
};
