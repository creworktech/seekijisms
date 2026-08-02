<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'customer_code',
        'name',
        'mobile',
        'address',
        'is_active', // controls eligibility to show on the Dashboard (1 = show on dashboard, 0 = hide from dashboard)
        'registered_on',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'registered_on' => 'date',
        ];
    }

    /**
     * Scope query to only customers eligible to display on the Dashboard.
     */
    public function scopeDashboardActive($query)
    {
        return $query->where('is_active', true);
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(Job::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
