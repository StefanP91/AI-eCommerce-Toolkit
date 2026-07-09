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
        'store_password',
        'platform',
        'api_credentials',
        'api_connected_at',
        'status',
        'product_count',
        'avg_seo_score',
        'last_scanned_at',
        'error_message',
    ];

    protected $hidden = [
        'store_password',
        'api_credentials',
    ];

    protected function casts(): array
    {
        return [
            'last_scanned_at' => 'datetime',
            'api_connected_at' => 'datetime',
            'store_password' => 'encrypted',
            'api_credentials' => 'encrypted:array',
        ];
    }

    public function hasApiConnection(): bool
    {
        return filled($this->platform) && filled($this->api_credentials);
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
