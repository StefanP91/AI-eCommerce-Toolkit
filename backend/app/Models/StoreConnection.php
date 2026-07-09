<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StoreConnection extends Model
{
    protected $fillable = [
        'user_id',
        'store_url',
        'status',
        'product_count',
        'avg_seo_score',
        'last_scanned_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'last_scanned_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(StoreProduct::class);
    }
}
