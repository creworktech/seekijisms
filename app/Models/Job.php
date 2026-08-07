<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Job extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'token_no',
        'customer_id',
        'product_name',
        'brand',
        'serial_no',
        'power_rating',
        'fault_description',
        'customer_remark',
        'received_from',
        'priority',
        'stage',
        'outcome',
        'tester_id',
        'technician_id',
        'tester_findings',
        'estimated_budget',
        'approved_amount',
        'final_amount',
        'payable_amount',
        'paid_amount',
        'is_paid',
        'payment_mode',
        'paid_at',
        'pend_reason',
        'delivery_mode',
        'delivery_receiver',
        'delivery_ref',
        'in_date',
        'out_date',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'estimated_budget' => 'decimal:2',
            'approved_amount' => 'decimal:2',
            'final_amount' => 'decimal:2',
            'payable_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'is_paid' => 'boolean',
            'in_date' => 'date',
            'out_date' => 'date',
            'paid_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function tester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tester_id');
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(JobEvent::class)->orderBy('created_at', 'asc');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(JobPayment::class)->orderBy('collected_at', 'asc');
    }

    /**
     * How much is left to collect. Null until the job has a bill at all
     * (payable_amount unset), never negative even if paid_amount somehow
     * overshoots (e.g. a manual correction).
     */
    public function dueAmount(): ?float
    {
        if ($this->payable_amount === null) {
            return null;
        }

        return max(0.0, round((float) $this->payable_amount - (float) $this->paid_amount, 2));
    }

    /**
     * 'unpaid' | 'partial' | 'paid' | null (no bill yet). Distinct from the
     * is_paid column, which only distinguishes fully-settled from not.
     */
    public function paymentStatus(): ?string
    {
        if ($this->payable_amount === null) {
            return null;
        }

        // Checked first rather than paid_amount: a ₹0 bill (e.g. waived, or
        // an outcome with no inspection fee configured) has nothing owed
        // and reads as settled even though nothing was ever "collected".
        if ($this->dueAmount() <= 0) {
            return 'paid';
        }

        return (float) $this->paid_amount > 0 ? 'partial' : 'unpaid';
    }

    /**
     * Only jobs that have been billed and still have money outstanding —
     * the correct predicate for "unpaid" filters, since is_paid alone would
     * also match jobs with no bill yet.
     */
    public function scopeWithOutstandingDue(Builder $query): Builder
    {
        return $query->whereNotNull('payable_amount')
            ->whereColumn('paid_amount', '<', 'payable_amount');
    }

    /**
     * The true remaining balance across a set of jobs — sum(payable_amount)
     * alone overstates it for anything partially paid, since part of that
     * bill has already been collected.
     */
    public static function sumOutstandingDue($query = null): float
    {
        $query = $query ? clone $query : static::query();

        // Plain subtraction rather than GREATEST(..., 0): that function
        // isn't portable between MySQL (production) and SQLite (tests), and
        // paid_amount is never allowed to exceed payable_amount in the
        // first place — every write path clamps it — so this never actually
        // needs flooring at 0 in practice.
        return (float) $query->whereNotNull('payable_amount')
            ->whereColumn('paid_amount', '<', 'payable_amount')
            ->sum(DB::raw('(payable_amount - paid_amount)'));
    }
}
