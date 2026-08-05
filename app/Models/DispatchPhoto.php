<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchPhoto extends Model
{
    use HasFactory;

    public const TYPE_BUS = 'bus';
    public const TYPE_PACKAGE = 'package';
    public const TYPE_RECEIPT = 'receipt';

    /** Per-type upload ceiling, enforced server side. */
    public const MAX_PER_TYPE = [
        self::TYPE_BUS => 2,
        self::TYPE_PACKAGE => 2,
        self::TYPE_RECEIPT => 2,
    ];

    protected $fillable = [
        'dispatch_id',
        'type',
        'path',
        'thumb_path',
    ];

    public function dispatch(): BelongsTo
    {
        return $this->belongsTo(Dispatch::class);
    }

    public function scopeOfType(Builder $query, string $type): Builder
    {
        return $query->where('type', $type);
    }
}
