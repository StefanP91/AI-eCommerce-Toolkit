<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BulkUploadController;
use App\Http\Controllers\Api\CreditsController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HistoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\ShopifyAuthController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\ToolController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/analytics/visit', [AnalyticsController::class, 'track']);
Route::get('/auth/shopify/callback', [ShopifyAuthController::class, 'callback']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::middleware('active')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/credits', [CreditsController::class, 'show']);

    Route::post('/products/generate', [ProductController::class, 'generate']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products/export-all', [ProductController::class, 'exportAll']);
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    Route::get('/products/{product}/export', [ProductController::class, 'export']);
    Route::post('/products/{product}/push-to-store', [ProductController::class, 'pushToStore']);

    Route::get('/history', [HistoryController::class, 'index']);
    Route::get('/history/{history}', [HistoryController::class, 'show']);
    Route::post('/history/{history}/save-product', [HistoryController::class, 'saveProduct']);

    Route::post('/tools/titles', [ToolController::class, 'generateTitles']);
    Route::post('/tools/meta', [ToolController::class, 'generateMeta']);
    Route::post('/tools/seo-audit', [ToolController::class, 'seoAudit']);
    Route::post('/tools/translate', [ToolController::class, 'translate']);
    Route::post('/tools/schema', [ToolController::class, 'generateSchema']);
    Route::post('/tools/image-optimize', [ToolController::class, 'optimizeImage']);

    Route::get('/bulk/template', [BulkUploadController::class, 'template']);
    Route::post('/bulk/upload', [BulkUploadController::class, 'store']);
    Route::get('/bulk/{bulkUpload}', [BulkUploadController::class, 'show']);
    Route::post('/bulk/{bulkUpload}/process-next', [BulkUploadController::class, 'processNext']);
    Route::delete('/bulk/{bulkUpload}', [BulkUploadController::class, 'destroy']);

    Route::put('/settings', [SettingsController::class, 'update']);
    Route::post('/support', [SupportController::class, 'store']);

    Route::get('/store', [StoreController::class, 'show']);
    Route::post('/store', [StoreController::class, 'connect']);
    Route::post('/store/scan', [StoreController::class, 'scan']);
    Route::post('/store/audit-url', [StoreController::class, 'auditUrl']);
    Route::get('/store/products', [StoreController::class, 'products']);
    Route::post('/store/api', [StoreController::class, 'connectApi']);
    Route::delete('/store/api', [StoreController::class, 'disconnectApi']);
    Route::get('/store/shopify/oauth', [ShopifyAuthController::class, 'redirect']);
    Route::delete('/store', [StoreController::class, 'destroy']);

        Route::middleware('admin')->prefix('admin')->group(function () {
            Route::get('/stats', [AdminController::class, 'stats']);
            Route::get('/users', [AdminController::class, 'users']);
            Route::get('/support', [AdminController::class, 'supportRequests']);
            Route::patch('/support/{supportRequest}', [AdminController::class, 'updateSupportRequest']);
            Route::patch('/users/{user}', [AdminController::class, 'updateUser']);
        });
    });
});
