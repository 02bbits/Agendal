<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// NF-16. The API only returns JSON, so its CSP allows nothing. The pages' CSP is set by Next.js.
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->add([
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()',
        ]);
        // The local API docs page loads its viewer script, so it is left out
        if (! $request->is('docs/*')) {
            $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        }
        header_remove('X-Powered-By');

        return $response;
    }
}
