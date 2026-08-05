<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Location extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'is_central',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_central' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function stops(): HasMany
    {
        return $this->hasMany(Stop::class);
    }

    public function activeStops(): HasMany
    {
        return $this->hasMany(Stop::class)->where('is_active', true);
    }

    public function users(): HasMany
    {
        return $this->hasMany(LogisticsUser::class);
    }

    public function activeUsers(): HasMany
    {
        return $this->hasMany(LogisticsUser::class)->where('is_active', true);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeCentral(Builder $query): Builder
    {
        return $query->where('is_central', true);
    }

    public function scopeSpoke(Builder $query): Builder
    {
        return $query->where('is_central', false);
    }

    /**
     * The single hub location. Exactly one row may carry is_central.
     */
    public static function hub(): ?self
    {
        return static::query()->central()->first();
    }
}
