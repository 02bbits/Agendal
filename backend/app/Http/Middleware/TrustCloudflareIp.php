<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Deployment: behind the Cloudflare tunnel and the Next.js rewrite every request comes from the
// web container, so the client IP is the one Cloudflare puts in CF-Connecting-IP. Cloudflare
// overwrites that header and the API has no other way in, so it can be trusted. Off by default:
// anywhere else, a client could set it and slip past the per-IP limits and lockout (AA-3, NF-13).
class TrustCloudflareIp
{
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->headers->get('CF-Connecting-IP');
        if (config('app.trust_cf_connecting_ip') && filter_var($ip, FILTER_VALIDATE_IP)) {
            $request->server->set('REMOTE_ADDR', $ip);
        }

        return $next($request);
    }
}
