<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

// T-AP-40: every log line and error response carries the same ID, so support can find the request
class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = 'req_'.Str::random(16);
        Context::add('request_id', $id);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $id);

        return $response;
    }
}
