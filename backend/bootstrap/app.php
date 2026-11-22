<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnsureEmailVerified;
use App\Http\Middleware\ForgetSessionCookieAfterSignOut;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SyncTimezone;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Middleware\Authorize;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Contracts\Session\Middleware\AuthenticatesSessions;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Routing\Middleware\ThrottleRequestsWithRedis;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\View\Middleware\ShareErrorsFromSession;
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
        $middleware->append(ForgetSessionCookieAfterSignOut::class);
        // Sanctum SPA cookie sessions (ADR-007)
        $middleware->statefulApi();
        $middleware->throttleApi(); // NF-13: the 'api' limiter
        // SC-11: the limiter counts before authentication. Laravel's default order authenticates
        // first, so a guest's 401 on a signed-in route was never counted and could flood without
        // limit. The rest is Laravel's default order; the limiter still keys a signed-in request
        // by its user, since the session has started by then
        $middleware->priority([
            HandlePrecognitiveRequests::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            ThrottleRequests::class,
            ThrottleRequestsWithRedis::class,
            AuthenticatesRequests::class,
            AuthenticatesSessions::class,
            SubstituteBindings::class,
            Authorize::class,
        ]);
        $middleware->appendToGroup('api', SyncTimezone::class);
        $middleware->alias([
            'verified-email' => EnsureEmailVerified::class,
        ]);
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
            $noteError = $e instanceof ValidationException ? ($e->errors()['text'][0] ?? null) : null;
            [$code, $message] = match ($status) {
                401 => ['auth.session_expired', "You've been signed out. Sign in to continue."],
                404 => ['error.not_found', 'This item no longer exists.'],
                // A note's own validation codes (note.empty, note.too_long, …) are the error code (NU §7).
                422 => [is_string($noteError) && str_starts_with($noteError, 'note.') ? $noteError : 'error.invalid', 'Check the highlighted fields.'],
                429 => ['error.rate_limited', "You're going a bit fast. Try again shortly."],
                default => ['error.generic', 'Something went wrong. Try again.'],
            };

            $error = ['code' => $code, 'message' => $message, 'request_id' => Context::get('request_id')];
            if ($e instanceof ValidationException) {
                $error['fields'] = $e->errors();
            }
            if ($status === 429) {
                $headers = $e instanceof HttpExceptionInterface ? $e->getHeaders() : [];
                $retryAfter = $headers['Retry-After'] ?? $headers['retry-after'] ?? null;
                if ($retryAfter !== null) {
                    $error['retry_after'] = (int) $retryAfter;
                }
            }

            return response()->json(
                ['error' => $error],
                $status,
                $e instanceof HttpExceptionInterface ? $e->getHeaders() : [],
            );
        });
    })->create();
