<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BulkUploadItem extends Model
{
    protected $fillable = [
        'bulk_upload_id',
        'row_number',
        'input_type',
        'product_name',
        'product_url',
        'manual_info',
        'language',
        'tone',
        'target_country',
        'category',
        'status',
        'error_message',
        'product_id',
    ];

    public function bulkUpload(): BelongsTo
    {
        return $this->belongsTo(BulkUpload::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function toInputArray(): array
    {
        return [
            'input_type' => $this->input_type,
            'product_name' => $this->product_name,
            'product_url' => $this->product_url,
            'manual_info' => $this->manual_info,
            'language' => $this->language,
            'tone' => $this->tone,
            'target_country' => $this->target_country,
            'category' => $this->category ?? 'General',
        ];
    }
}
