<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

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
}
