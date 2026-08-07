<?php

namespace App\Models;

use App\Enums\DispatchStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A parcel handed to a bus conductor at one bus stand and collected at another.
 *
 * bus_reach_time is when the bus arrived at the pickup stand ("in time"),
 * recorded by the sender while standing at from_stop.
 */
class Dispatch extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'reference_no',
        'client_uuid',
        'sender_id',
        'receiver_id',
        'from_stop_id',
        'to_stop_id',
        'quantity',
        'driver_mobile',
        'bus_reach_time',
        'status',
        'received_at',
        'received_by',
        'receipt_note',
        'receipt_latitude',
        'receipt_longitude',
        'dispatch_date',
    ];

    protected function casts(): array
    {
        return [
            'status' => DispatchStatus::class,
            'quantity' => 'integer',
            'dispatch_date' => 'date',
            'received_at' => 'datetime',
            'receipt_latitude' => 'decimal:7',
            'receipt_longitude' => 'decimal:7',
        ];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(LogisticsUser::class, 'sender_id')->withTrashed();
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(LogisticsUser::class, 'receiver_id')->withTrashed();
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(LogisticsUser::class, 'received_by')->withTrashed();
    }

    public function fromStop(): BelongsTo
    {
        return $this->belongsTo(Stop::class, 'from_stop_id')->withTrashed();
    }

    public function toStop(): BelongsTo
    {
        return $this->belongsTo(Stop::class, 'to_stop_id')->withTrashed();
    }

    public function photos(): HasMany
    {
        return $this->hasMany(DispatchPhoto::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(DispatchEvent::class)->orderBy('created_at');
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', DispatchStatus::PENDING);
    }

    public function isPending(): bool
    {
        return $this->status === DispatchStatus::PENDING;
    }

    /**
     * Rule 7: a dispatch may only leave pending, except that not_received
     * may still become received if the package later turns up.
     */
    public function canTransitionTo(DispatchStatus $target): bool
    {
        return match ($this->status) {
            DispatchStatus::PENDING => $target !== DispatchStatus::PENDING,
            DispatchStatus::NOT_RECEIVED => $target === DispatchStatus::RECEIVED,
            DispatchStatus::RECEIVED => false,
        };
    }

    /**
     * Rule 8: editable only while pending, and only by its sender.
     */
    public function isEditableBy(LogisticsUser $user): bool
    {
        return $this->isPending() && $this->sender_id === $user->id;
    }
}
