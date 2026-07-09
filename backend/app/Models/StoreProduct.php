<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreProduct extends Model
{
    protected $fillable = [
        'store_connection_id',
        'url',
        'product_name',
        'seo_score',
        'seo_checks',
        'status',
        'error_message',
        'last_scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'seo_checks' => 'array',
            'last_scanned_at' => 'datetime',
        ];
    }

    public function storeConnection(): BelongsTo
    {
        return $this->belongsTo(StoreConnection::class);
    }
}
