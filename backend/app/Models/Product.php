<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'user_id',
        'input_type',
        'product_name',
        'product_url',
        'manual_info',
        'language',
        'tone',
        'target_country',
        'category',
        'generated_content',
        'seo_score',
        'seo_checks',
        'shopify_product_id',
    ];

    protected function casts(): array
    {
        return [
            'generated_content' => 'array',
            'seo_checks' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function histories(): HasMany
    {
        return $this->hasMany(GenerationHistory::class);
    }
}
