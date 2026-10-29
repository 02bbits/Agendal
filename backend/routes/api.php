<?php

use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', RegisterController::class)->middleware('throttle:register');
Route::post('/auth/login', LoginController::class);
Route::post('/auth/forgot-password', ForgotPasswordController::class)->middleware('throttle:forgot-password');
Route::post('/auth/reset-password', ResetPasswordController::class)->middleware('throttle:reset-password');

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
