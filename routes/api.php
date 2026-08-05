<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DeliveryController;
use App\Http\Controllers\Api\V1\JobController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\Logistics\Admin\DashboardController as LogisticsAdminDashboardController;
use App\Http\Controllers\Api\V1\Logistics\Admin\DispatchController as LogisticsAdminDispatchController;
use App\Http\Controllers\Api\V1\Logistics\Admin\LocationController as LogisticsAdminLocationController;
use App\Http\Controllers\Api\V1\Logistics\Admin\StopController as LogisticsAdminStopController;
use App\Http\Controllers\Api\V1\Logistics\Admin\UserController as LogisticsAdminUserController;
use App\Http\Controllers\Api\V1\Logistics\AuthController as LogisticsAuthController;
use App\Http\Controllers\Api\V1\Logistics\BootstrapController;
use App\Http\Controllers\Api\V1\Logistics\DispatchController as LogisticsDispatchController;
use App\Http\Controllers\Api\V1\Logistics\PhotoController as LogisticsPhotoController;
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
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->middleware('can:users.manage');
        Route::patch('/customers/{customer}/toggle-status', [CustomerController::class, 'toggleStatus'])->middleware('can:customers.toggle');
        Route::get('/customers/{customer}/jobs', [CustomerController::class, 'jobs'])->middleware('can:jobs.view');

        // Jobs
        Route::get('/jobs/token-preview', [JobController::class, 'tokenPreview']);
        Route::get('/jobs', [JobController::class, 'index'])->middleware('can:jobs.view');
        Route::post('/jobs', [JobController::class, 'store'])->middleware('can:jobs.create');
        Route::get('/jobs/{job}', [JobController::class, 'show'])->middleware('can:jobs.view');
        Route::put('/jobs/{job}', [JobController::class, 'update'])->middleware('can:jobs.create');
        Route::delete('/jobs/{job}', [JobController::class, 'destroy'])->middleware('can:users.manage');
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

/*
|--------------------------------------------------------------------------
| Logistics API v1 — bus-parcel tracking between Ranchi and the spokes
|--------------------------------------------------------------------------
|
| Authenticates on the separate `logistics` guard, so a Service Management
| System token can never reach these routes and vice versa.
|
| Namespaced under /v1/logistics rather than bare /v1: the Service Management
| API already owns /v1/auth/login, and Laravel matches the first registered
| route, which would otherwise leave logistics login unreachable.
|
*/

Route::prefix('v1/logistics')->name('logistics.')->group(function () {

    Route::post('/auth/login', [LogisticsAuthController::class, 'login'])
        ->middleware('throttle:5,1')
        ->name('auth.login');

    Route::middleware('auth:logistics')->group(function () {

        // Auth
        Route::post('/auth/logout', [LogisticsAuthController::class, 'logout'])->name('auth.logout');
        Route::get('/auth/me', [LogisticsAuthController::class, 'me'])->name('auth.me');

        // One call on app launch
        Route::get('/bootstrap', BootstrapController::class)->name('bootstrap');

        // Dispatches
        Route::get('/dispatches/sent', [LogisticsDispatchController::class, 'sent'])->name('dispatches.sent');
        Route::get('/dispatches/received', [LogisticsDispatchController::class, 'received'])->name('dispatches.received');
        Route::post('/dispatches', [LogisticsDispatchController::class, 'store'])->name('dispatches.store');
        Route::get('/dispatches/{dispatch}', [LogisticsDispatchController::class, 'show'])->name('dispatches.show');
        Route::put('/dispatches/{dispatch}', [LogisticsDispatchController::class, 'update'])->name('dispatches.update');
        Route::post('/dispatches/{dispatch}/receive', [LogisticsDispatchController::class, 'receive'])->name('dispatches.receive');
    });

    // Photos live outside the public directory. Either guard may view, and the
    // controller decides whether this particular viewer is allowed.
    Route::get('/photos/{photo}', [LogisticsPhotoController::class, 'show'])
        ->middleware('auth:logistics,web')
        ->name('photos.show');

    // Admin surface: logistics admins by token, SMS web admins by session.
    Route::prefix('admin')->name('admin.')
        ->middleware(['auth:logistics,web', 'logistics.admin'])
        ->group(function () {

            Route::get('/dashboard/stats', [LogisticsAdminDashboardController::class, 'stats'])->name('dashboard.stats');

            Route::get('/dispatches', [LogisticsAdminDispatchController::class, 'index'])->name('dispatches.index');
            Route::get('/dispatches/{dispatch}', [LogisticsAdminDispatchController::class, 'show'])->name('dispatches.show');
            Route::delete('/dispatches/{dispatch}', [LogisticsAdminDispatchController::class, 'destroy'])->name('dispatches.destroy');

            Route::get('/users', [LogisticsAdminUserController::class, 'index'])->name('users.index');
            Route::post('/users', [LogisticsAdminUserController::class, 'store'])->name('users.store');
            Route::put('/users/{logisticsUser}', [LogisticsAdminUserController::class, 'update'])->name('users.update');
            Route::patch('/users/{logisticsUser}/toggle-status', [LogisticsAdminUserController::class, 'toggleStatus'])->name('users.toggle');
            Route::delete('/users/{logisticsUser}', [LogisticsAdminUserController::class, 'destroy'])->name('users.destroy');
            Route::post('/users/{logisticsUser}/reset-password', [LogisticsAdminUserController::class, 'resetPassword'])->name('users.reset-password');

            Route::get('/locations', [LogisticsAdminLocationController::class, 'index'])->name('locations.index');
            Route::post('/locations', [LogisticsAdminLocationController::class, 'store'])->name('locations.store');
            Route::put('/locations/{location}', [LogisticsAdminLocationController::class, 'update'])->name('locations.update');
            Route::patch('/locations/{location}/toggle-status', [LogisticsAdminLocationController::class, 'toggleStatus'])->name('locations.toggle');
            Route::delete('/locations/{location}', [LogisticsAdminLocationController::class, 'destroy'])->name('locations.destroy');
            Route::get('/locations/{location}/stops', [LogisticsAdminLocationController::class, 'stops'])->name('locations.stops');

            Route::post('/stops', [LogisticsAdminStopController::class, 'store'])->name('stops.store');
            Route::put('/stops/{stop}', [LogisticsAdminStopController::class, 'update'])->name('stops.update');
            Route::patch('/stops/{stop}/toggle-status', [LogisticsAdminStopController::class, 'toggleStatus'])->name('stops.toggle');
            Route::delete('/stops/{stop}', [LogisticsAdminStopController::class, 'destroy'])->name('stops.destroy');
        });
});
