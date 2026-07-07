<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenerationHistory extends Model
{
    protected $fillable = [
        'user_id',
        'product_id',
        'type',
        'input_summary',
        'seo_score',
        'result_data',
    ];

    protected function casts(): array
    {
        return [
            'result_data' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
