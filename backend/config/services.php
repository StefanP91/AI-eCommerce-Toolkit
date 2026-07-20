<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    'ai' => [
        'provider' => env('AI_PROVIDER', 'gemini'),
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
    ],

    'shopify' => [
        'api_key' => env('SHOPIFY_API_KEY'),
        'api_secret' => env('SHOPIFY_API_SECRET'),
        'scopes' => env('SHOPIFY_SCOPES', 'read_products,write_products'),
        'redirect_uri' => env('SHOPIFY_REDIRECT_URI', rtrim((string) env('APP_URL', 'http://localhost:8000'), '/').'/api/auth/shopify/callback'),
    ],

    'lemon_squeezy' => [
        'api_key' => env('LEMON_SQUEEZY_API_KEY'),
        'store_id' => env('LEMON_SQUEEZY_STORE_ID'),
        'variant_id' => env('LEMON_SQUEEZY_VARIANT_ID'),
        'webhook_secret' => env('LEMON_SQUEEZY_WEBHOOK_SECRET'),
    ],

];
