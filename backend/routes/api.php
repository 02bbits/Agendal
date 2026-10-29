<?php

declare(strict_types=1);

use App\Http\Controllers\NoteController;
use App\Http\Controllers\TaskController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('notes', [NoteController::class, 'store'])->middleware('throttle:notes');
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('tasks', [TaskController::class, 'store']);
    Route::get('tasks/{task}', [TaskController::class, 'show']);
    Route::patch('tasks/{task}', [TaskController::class, 'update']);
    Route::post('tasks/{task}/complete', [TaskController::class, 'complete']);
    Route::post('tasks/{task}/reopen', [TaskController::class, 'reopen']);
    Route::delete('tasks/{task}', [TaskController::class, 'destroy']);
    Route::post('tasks/{task}/restore', [TaskController::class, 'restore'])->withTrashed();
});
