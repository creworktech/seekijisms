<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * A logistics staff account. Distinct from App\Models\User (the Service
 * Management System's web staff) — this one authenticates by mobile number
 * and always belongs to exactly one location.
 */
class LogisticsUser extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $table = 'logistics_users';

    protected $fillable = [
        'name',
        'mobile',
        'password',
        'location_id',
        'default_stop_id',
        'is_central',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_central' => 'boolean',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class)->withTrashed();
    }

    public function defaultStop(): BelongsTo
    {
        return $this->belongsTo(Stop::class, 'default_stop_id')->withTrashed();
    }

    public function sentDispatches(): HasMany
    {
        return $this->hasMany(Dispatch::class, 'sender_id');
    }

    public function receivedDispatches(): HasMany
    {
        return $this->hasMany(Dispatch::class, 'receiver_id');
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

    public function isSpoke(): bool
    {
        return ! $this->is_central;
    }

    /**
     * Any active user at the same location may act on that location's inbound
     * dispatches — the first to confirm wins, and the acting user is logged.
     */
    public function sharesLocationWith(self $other): bool
    {
        return $this->location_id === $other->location_id;
    }
}
