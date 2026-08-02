<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DeliveryController;
use App\Http\Controllers\Api\V1\JobController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Seekoji Service Management Backend API v1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // Public Auth
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    // Meta WhatsApp Webhook Verification & Listener (Public Endpoint)
    Route::get('/webhooks/whatsapp/meta', function (\Illuminate\Http\Request $request) {
        $verifyToken = env('META_WHATSAPP_VERIFY_TOKEN', 'seekoji_meta_wa_verify_2026');
        if ($request->input('hub_mode') === 'subscribe' && $request->input('hub_verify_token') === $verifyToken) {
            return response($request->input('hub_challenge'), 200)->header('Content-Type', 'text/plain');
        }
        return response('Invalid verify token', 403);
    });

    Route::post('/webhooks/whatsapp/meta', function (\Illuminate\Http\Request $request) {
        \Illuminate\Support\Facades\Log::info('Meta WhatsApp Webhook Payload Received:', $request->all());
        return response()->json(['status' => 'success'], 200);
    });

    // Protected API Routes (Supports both Sanctum Bearer tokens and Web Session Cookies)
    Route::middleware('auth:sanctum,web')->group(function () {

        // Auth management
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Customers
        Route::get('/customers/check-mobile', [CustomerController::class, 'checkMobile'])->middleware('can:customers.create');
        Route::get('/customers', [CustomerController::class, 'index'])->middleware('can:customers.view');
        Route::post('/customers', [CustomerController::class, 'store'])->middleware('can:customers.create');
        Route::get('/customers/{customer}', [CustomerController::class, 'show'])->middleware('can:customers.view');
        Route::put('/customers/{customer}', [CustomerController::class, 'update'])->middleware('can:customers.update');
        Route::patch('/customers/{customer}/toggle-status', [CustomerController::class, 'toggleStatus'])->middleware('can:customers.toggle');
        Route::get('/customers/{customer}/jobs', [CustomerController::class, 'jobs'])->middleware('can:jobs.view');

        // Jobs
        Route::get('/jobs', [JobController::class, 'index'])->middleware('can:jobs.view');
        Route::post('/jobs', [JobController::class, 'store'])->middleware('can:jobs.create');
        Route::get('/jobs/{job}', [JobController::class, 'show'])->middleware('can:jobs.view');
        Route::put('/jobs/{job}', [JobController::class, 'update'])->middleware('can:jobs.create');
        Route::get('/jobs/{job}/events', [JobController::class, 'events'])->middleware('can:jobs.view');
        Route::post('/jobs/{job}/transition', [JobController::class, 'transition'])->middleware('can:jobs.transition');

        // Delivery
        Route::get('/delivery', [DeliveryController::class, 'index'])->middleware('can:jobs.view');
        Route::post('/jobs/{job}/deliver', [DeliveryController::class, 'deliver'])->middleware('can:jobs.deliver');

        // Dashboard
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
        Route::get('/dashboard/recent-jobs', [DashboardController::class, 'recentJobs']);

        // Reports
        Route::get('/reports/jobs', [ReportController::class, 'jobs'])->middleware('can:reports.view');
        Route::get('/reports/jobs/export', [ReportController::class, 'export'])->middleware('can:reports.export');

        // Users Management
        Route::get('/users', [UserController::class, 'index'])->middleware('can:users.manage');
        Route::post('/users', [UserController::class, 'store'])->middleware('can:users.manage');
        Route::get('/users/{user}', [UserController::class, 'show'])->middleware('can:users.manage');
        Route::put('/users/{user}', [UserController::class, 'update'])->middleware('can:users.manage');
        Route::patch('/users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->middleware('can:users.manage');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('can:users.manage');

        // Settings
        Route::get('/settings', [SettingController::class, 'index']);
        Route::put('/settings', [SettingController::class, 'update'])->middleware('can:settings.manage');

    });
});
