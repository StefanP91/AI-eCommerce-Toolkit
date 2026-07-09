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

    public function toApiArray(): array
    {
        $optimizedCount = $this->products()->where('seo_score', '>=', 80)->count();
        $needsWorkCount = $this->products()->where('seo_score', '<', 60)->count();

        return [
            'id' => $this->id,
            'store_url' => $this->store_url,
            'has_visitor_password' => filled($this->store_password),
            'platform' => $this->platform,
            'has_api_connection' => $this->hasApiConnection(),
            'connection_method' => $this->api_credentials['connection_type'] ?? null,
            'shopify_oauth_enabled' => filled(config('services.shopify.api_key'))
                && filled(config('services.shopify.api_secret')),
            'api_connected_at' => $this->api_connected_at?->toIso8601String(),
            'push_available' => $this->hasApiConnection() && $this->platform === 'shopify',
            'status' => $this->status,
            'product_count' => $this->product_count,
            'avg_seo_score' => $this->avg_seo_score,
            'optimized_count' => $optimizedCount,
            'needs_work_count' => $needsWorkCount,
            'last_scanned_at' => $this->last_scanned_at?->toIso8601String(),
            'error_message' => $this->error_message,
        ];
    }
}
