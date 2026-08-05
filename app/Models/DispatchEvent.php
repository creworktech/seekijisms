<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable audit log. Rows are written once by DispatchService and are
 * never updated or deleted.
 */
class DispatchEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'dispatch_id',
        'user_id',
        'action',
        'from_status',
        'to_status',
        'note',
        'meta',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function dispatch(): BelongsTo
    {
        return $this->belongsTo(Dispatch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(LogisticsUser::class, 'user_id')->withTrashed();
    }
}
