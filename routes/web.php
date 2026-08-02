<?php

use App\Http\Controllers\Web\WebController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes — Seekoji Service Management Frontend (Inertia.js)
|--------------------------------------------------------------------------
*/

// Guest Auth Routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [WebController::class, 'loginForm'])->name('login');
    Route::post('/login', [WebController::class, 'login']);
});

// Protected Web Routes
Route::middleware('auth')->group(function () {
    Route::post('/logout', [WebController::class, 'logout'])->name('logout');

    Route::get('/', function () {
        return redirect()->route('dashboard');
    });

    Route::get('/dashboard', [WebController::class, 'dashboard'])->name('dashboard');
    Route::get('/customers', [WebController::class, 'customers'])->name('customers.index');
    Route::get('/customers/search', [WebController::class, 'searchCustomers'])->name('customers.search');
    Route::get('/jobs', [WebController::class, 'jobs'])->name('jobs.index');
    Route::post('/jobs', [WebController::class, 'storeJob'])->name('jobs.store');
    Route::put('/jobs/{job}', [WebController::class, 'updateJob'])->name('jobs.update');
    Route::get('/delivery', [WebController::class, 'delivery'])->name('delivery.index');
    Route::get('/accounts', [WebController::class, 'accounts'])->name('accounts.index');
    Route::get('/reports', [WebController::class, 'reports'])->name('reports.index');

    // Admin Only Pages
    Route::middleware('can:users.manage')->group(function () {
        Route::get('/jcc', [WebController::class, 'jcc'])->name('jobs.jcc');
        Route::post('/jobs/{job}/toggle-payment', [WebController::class, 'togglePayment'])->name('jobs.toggle-payment');
        Route::get('/users', [WebController::class, 'users'])->name('users.index');
        Route::get('/settings', [WebController::class, 'settings'])->name('settings.index');
    });
});
