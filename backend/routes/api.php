<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\ChangePasswordController;
use App\Http\Controllers\Auth\CheckPasswordController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResendVerificationController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\Auth\TwoFactorChallengeController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\Auth\TwoFactorResendController;
use App\Http\Controllers\Auth\VerifyEmailController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\NoteController;
use App\Http\Controllers\NoteSearchController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', RegisterController::class)->middleware('throttle:register');
Route::post('/auth/login', LoginController::class);
Route::post('/auth/logout', LogoutController::class);
Route::post('/auth/forgot-password', ForgotPasswordController::class)->middleware('throttle:forgot-password');
Route::post('/auth/reset-password', ResetPasswordController::class)->middleware('throttle:reset-password');
Route::post('/auth/two-factor/challenge', TwoFactorChallengeController::class);
Route::post('/auth/two-factor/resend', TwoFactorResendController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [MeController::class, 'show']);
    Route::patch('me', [MeController::class, 'update']);
    Route::post('auth/logout-everywhere', [LogoutController::class, 'everywhere']);
    Route::post('auth/verify-email', VerifyEmailController::class);
    Route::post('auth/verify-email/resend', ResendVerificationController::class);

    Route::middleware('verified-email')->group(function () {
        Route::post('auth/two-factor', TwoFactorController::class);
        Route::post('auth/change-password', ChangePasswordController::class);
        Route::post('auth/check-password', CheckPasswordController::class);
        Route::post('notes', [NoteController::class, 'store'])->middleware('throttle:notes');
        Route::get('notes', [NoteController::class, 'index']);
        Route::get('notes/search', NoteSearchController::class)->middleware('throttle:search-notes');
        Route::get('notes/{note}', [NoteController::class, 'show']);
        Route::put('notes/{note}', [NoteController::class, 'update'])->middleware('throttle:notes');
        Route::patch('notes/{note}', [NoteController::class, 'rename']);
        Route::post('notes/{note}/make-task', [NoteController::class, 'makeTask']);
        Route::post('notes/{note}/apply', [NoteController::class, 'apply']);
        Route::post('notes/{note}/undo', [NoteController::class, 'undo']);
        Route::post('notes/{note}/redo', [NoteController::class, 'redo']);
        Route::delete('notes/{note}', [NoteController::class, 'destroy']);
        Route::post('notes/{note}/restore', [NoteController::class, 'restore'])->withTrashed();
        Route::get('projects', [ProjectController::class, 'index']);
        Route::post('projects', [ProjectController::class, 'store']);
        Route::get('projects/none', [ProjectController::class, 'none']);
        Route::get('projects/{project}', [ProjectController::class, 'show']);
        Route::patch('projects/{project}', [ProjectController::class, 'update']);
        Route::delete('projects/{project}', [ProjectController::class, 'destroy']);
        Route::post('projects/{id}/restore', [ProjectController::class, 'restore']);
        Route::post('tasks', [TaskController::class, 'store']);
        Route::get('tasks', [TaskController::class, 'index']);
        Route::get('tasks/search', [TaskController::class, 'search'])->middleware('throttle:search');
        Route::get('tasks/{task}', [TaskController::class, 'show']);
        Route::patch('tasks/{task}', [TaskController::class, 'update']);
        Route::post('tasks/{task}/complete', [TaskController::class, 'complete']);
        Route::post('tasks/{task}/reopen', [TaskController::class, 'reopen']);
        Route::delete('tasks/{task}', [TaskController::class, 'destroy']);
        Route::post('tasks/{task}/restore', [TaskController::class, 'restore'])->withTrashed();
    });
});
