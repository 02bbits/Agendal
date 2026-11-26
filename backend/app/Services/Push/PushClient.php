<?php

declare(strict_types=1);

namespace App\Services\Push;

use GuzzleHttp\Client;
use GuzzleHttp\Pool;
use GuzzleHttp\RequestOptions;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Sends push requests to the push services, many at once (PERF-03: 300 reminders within a
 * minute). Redirects are off, so a push service can't send the server somewhere else (SC-18),
 * and every request has short timeouts.
 */
class PushClient
{
    public function client(): Client
    {
        return new Client([
            RequestOptions::ALLOW_REDIRECTS => false,
            RequestOptions::HTTP_ERRORS => false,
            RequestOptions::TIMEOUT => (int) config('push.timeout'),
            RequestOptions::CONNECT_TIMEOUT => (int) config('push.connect_timeout'),
        ]);
    }

    /**
     * @param  list<RequestInterface>  $requests
     * @return list<ResponseInterface|\Throwable> one result per request, in order
     */
    public function sendAll(array $requests): array
    {
        if ($requests === []) {
            return [];
        }
        $results = Pool::batch($this->client(), $requests, ['concurrency' => (int) config('push.concurrency')]);

        return array_values(array_map(
            fn (mixed $result) => $result instanceof ResponseInterface || $result instanceof \Throwable
                ? $result
                : new \RuntimeException('No response'),
            $results,
        ));
    }
}
