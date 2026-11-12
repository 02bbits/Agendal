<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class ForgetSessionCookieAfterSignOut
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->attributes->get('signed_out', false) === true) {
            $name = (string) config('session.cookie');
            $path = (string) config('session.path', '/');
            $domain = config('session.domain');
            $secure = (bool) config('session.secure', true);
            $httpOnly = (bool) config('session.http_only', true);
            $sameSite = config('session.same_site', 'lax');

            $expiredCookie = Cookie::create(
                name: $name,
                value: '',
                expire: 1,
                path: $path,
                domain: $domain,
                secure: $secure,
                httpOnly: $httpOnly,
                raw: false,
                sameSite: $sameSite,
            );

            $response->headers->setCookie($expiredCookie);
        }

        return $response;
    }
}
