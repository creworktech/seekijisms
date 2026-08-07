<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per amount actually collected against a job's bill. The audit
 * trail behind Job::paid_amount, which is a running total kept in sync with
 * this table rather than the other source of truth.
 */
class JobPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'job_id',
        'amount',
        'payment_mode',
        'remarks',
        'collected_by',
        'collected_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'collected_at' => 'datetime',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class);
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }
}
