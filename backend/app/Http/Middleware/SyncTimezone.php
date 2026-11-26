<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Clock\UserTimezone;
use Closure;
use DateTimeZone;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class SyncTimezone
{
    public function __construct(
        private UserTimezone $userTimezone,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');
        $timezone = $request->header('X-Timezone');
        $storedTimezone = $user instanceof User ? $user->timezone : 'UTC';
        $request->attributes->set('timezone', $storedTimezone);

        if ($user instanceof User && $user->timezone_auto === false) {
            return $next($request);
        }

        if (! is_string($timezone) || ! in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            return $next($request);
        }

        $request->attributes->set('timezone', $timezone);
        // A personal access token uses its zone for this request only: storing it would move every
        // reminder, an account change no token may make (#196)
        if ($user instanceof User && $user->timezone !== $timezone && ! $user->currentAccessToken() instanceof PersonalAccessToken) {
            $this->userTimezone->change($user, $timezone);
        }

        return $next($request);
    }
}
