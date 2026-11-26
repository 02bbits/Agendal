<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\ChangePasswordController;
use App\Http\Controllers\Auth\CheckPasswordController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\PendingSignupController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\Auth\TwoFactorChallengeController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\Auth\TwoFactorResendController;
use App\Http\Controllers\CountsController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\NoteController;
use App\Http\Controllers\NoteSearchController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\SyncController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TokenController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', RegisterController::class)->middleware('throttle:register');
Route::post('/auth/login', LoginController::class);
Route::post('/auth/logout', LogoutController::class);
Route::post('/auth/forgot-password', ForgotPasswordController::class)->middleware('throttle:forgot-password');
Route::post('/auth/reset-password', ResetPasswordController::class)->middleware('throttle:reset-password');
Route::post('/auth/two-factor/challenge', TwoFactorChallengeController::class);
Route::post('/auth/two-factor/resend', TwoFactorResendController::class);
Route::get('/auth/signup', [PendingSignupController::class, 'show']);
Route::post('/auth/signup/verify', [PendingSignupController::class, 'verify']);
Route::post('/auth/signup/resend', [PendingSignupController::class, 'resend']);
Route::delete('/auth/signup', [PendingSignupController::class, 'cancel']);

Route::middleware('auth:sanctum')->group(function () {
    // A personal access token (#196) reaches only the data routes, each behind its ability. A session
    // has every ability; account and device routes are the session's alone
    Route::get('me', [MeController::class, 'show']);

    Route::middleware('session-only')->group(function () {
        Route::patch('me', [MeController::class, 'update']);
        Route::post('auth/logout-everywhere', [LogoutController::class, 'everywhere']);
    });

    Route::middleware('verified-email')->group(function () {
        Route::middleware('session-only')->group(function () {
            Route::post('auth/two-factor', TwoFactorController::class)->middleware('throttle:two-factor-toggle');
            Route::post('auth/change-password', ChangePasswordController::class);
            Route::post('auth/check-password', CheckPasswordController::class);
            Route::get('tokens', [TokenController::class, 'index']);
            Route::post('tokens', [TokenController::class, 'store']);
            Route::delete('tokens/{id}', [TokenController::class, 'destroy']);
            // Reminders (TK-6): this device's push subscription
            Route::get('push-subscriptions/key', [PushSubscriptionController::class, 'key']);
            Route::post('push-subscriptions', [PushSubscriptionController::class, 'store']);
            Route::delete('push-subscriptions', [PushSubscriptionController::class, 'destroy']);
            Route::post('push-subscriptions/test', [PushSubscriptionController::class, 'test'])->middleware('throttle:push-test');
        });

        Route::middleware('abilities:tasks:read')->group(function () {
            Route::get('counts', CountsController::class);
            Route::get('tasks', [TaskController::class, 'index']);
            Route::get('tasks/search', [TaskController::class, 'search'])->middleware('throttle:search');
            Route::get('tasks/{task}', [TaskController::class, 'show']);
        });
        Route::middleware('abilities:tasks:write')->group(function () {
            Route::post('tasks', [TaskController::class, 'store']);
            Route::patch('tasks/{task}', [TaskController::class, 'update']);
            Route::post('tasks/{task}/complete', [TaskController::class, 'complete']);
            Route::post('tasks/{task}/reopen', [TaskController::class, 'reopen']);
            Route::delete('tasks/{task}', [TaskController::class, 'destroy']);
            Route::post('tasks/{task}/restore', [TaskController::class, 'restore'])->withTrashed();
        });

        Route::middleware('abilities:projects:read')->group(function () {
            Route::get('projects', [ProjectController::class, 'index']);
            Route::get('projects/none', [ProjectController::class, 'none']);
            Route::get('projects/{project}', [ProjectController::class, 'show']);
        });
        Route::middleware('abilities:projects:write')->group(function () {
            Route::post('projects', [ProjectController::class, 'store']);
            Route::patch('projects/{project}', [ProjectController::class, 'update']);
            Route::delete('projects/{project}', [ProjectController::class, 'destroy']);
            Route::post('projects/{id}/restore', [ProjectController::class, 'restore']);
        });

        Route::middleware('abilities:notes:read')->group(function () {
            Route::get('notes', [NoteController::class, 'index']);
            Route::get('notes/search', NoteSearchController::class)->middleware('throttle:search-notes');
            Route::get('notes/{note}', [NoteController::class, 'show']);
        });
        Route::middleware('abilities:notes:write')->group(function () {
            Route::post('notes', [NoteController::class, 'store'])->middleware('throttle:notes');
            Route::put('notes/{note}', [NoteController::class, 'update'])->middleware('throttle:notes');
            Route::patch('notes/{note}', [NoteController::class, 'rename']);
            Route::delete('notes/{note}', [NoteController::class, 'destroy']);
            Route::post('notes/{note}/restore', [NoteController::class, 'restore'])->withTrashed();
        });
        // These change tasks through the note
        Route::middleware('abilities:notes:write,tasks:write')->group(function () {
            Route::post('notes/{note}/make-task', [NoteController::class, 'makeTask']);
            Route::post('notes/{note}/apply', [NoteController::class, 'apply']);
            Route::post('notes/{note}/undo', [NoteController::class, 'undo']);
            Route::post('notes/{note}/redo', [NoteController::class, 'redo']);
        });

        Route::get('sync', [SyncController::class, 'pull'])->middleware(['abilities:tasks:read,projects:read,notes:read', 'throttle:sync']);
        Route::post('sync/patches', [SyncController::class, 'patches'])->middleware('abilities:tasks:write,projects:write');
    });
});
