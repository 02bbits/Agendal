<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SyncTimezone;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/api/v1/health',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);
        $middleware->append(SecurityHeaders::class);
        // Sanctum SPA cookie sessions (ADR-007)
        $middleware->statefulApi();
        $middleware->appendToGroup('api', SyncTimezone::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // SC-21: the database message repeats the row's values (note and task text), so log the SQL only
        $exceptions->report(function (QueryException $e) {
            Log::error('Query failed', ['sql' => $e->getSql(), 'sqlstate' => $e->getCode()]);

            return false;
        });

        // One error shape for the API (api.md conventions). `code` is a copy-catalog key.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = match (true) {
                $e instanceof ValidationException => 422,
                $e instanceof AuthenticationException => 401,
                $e instanceof HttpExceptionInterface => $e->getStatusCode(),
                default => 500,
            };
            [$code, $message] = match ($status) {
                401 => ['auth.session_expired', "You've been signed out. Sign in to continue."],
                404 => ['error.not_found', 'This item no longer exists.'],
                422 => ['error.invalid', 'Check the highlighted fields.'],
                429 => ['error.rate_limited', "You're going a bit fast. Try again shortly."],
                default => ['error.generic', 'Something went wrong. Try again.'],
            };

            $error = ['code' => $code, 'message' => $message, 'request_id' => Context::get('request_id')];
            if ($e instanceof ValidationException) {
                $error['fields'] = $e->errors();
            }

            return response()->json(
                ['error' => $error],
                $status,
                $e instanceof HttpExceptionInterface ? $e->getHeaders() : [],
            );
        });
    })->create();
