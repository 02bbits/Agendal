<?php

declare(strict_types=1);

namespace App\Services\Push;

/**
 * SC-18: a subscription endpoint is accepted only as HTTPS on a known push service. The server
 * later posts to it, so anything else would let a user make the server reach any host (SSRF).
 */
final class PushEndpoint
{
    public static function allowed(string $url): bool
    {
        $parts = parse_url($url);
        if ($parts === false || ($parts['scheme'] ?? '') !== 'https') {
            return false;
        }
        // No credentials or custom port: push services are plain https on 443
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
            return false;
        }
        $host = strtolower($parts['host'] ?? '');
        foreach ((array) config('push.hosts') as $allowed) {
            $allowed = strtolower((string) $allowed);
            if ($host === $allowed || str_ends_with($host, '.'.$allowed)) {
                return true;
            }
        }

        return false;
    }
}
