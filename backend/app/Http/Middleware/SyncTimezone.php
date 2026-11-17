<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Clock\UserTimezone;
use Closure;
use DateTimeZone;
use Illuminate\Http\Request;
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
        if ($user instanceof User && $user->timezone !== $timezone) {
            $this->userTimezone->change($user, $timezone);
        }

        return $next($request);
    }
}
