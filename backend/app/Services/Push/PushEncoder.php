<?php

declare(strict_types=1);

namespace App\Services\Push;

use Minishlink\WebPush\MessageSentReport;
use Minishlink\WebPush\WebPush;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * The library's encryption and VAPID signing (RFC 8291, 8292), without its sending: the requests
 * go out through PushClient, which sends many at once (its own async sending needs a Guzzle 7
 * adapter, and the app is on Guzzle 8).
 */
final class PushEncoder extends WebPush
{
    /**
     * The queued notifications as signed, encrypted requests, in the order they were queued.
     *
     * @return list<RequestInterface>
     */
    public function takeRequests(): array
    {
        $notifications = $this->notifications ?? [];
        $this->notifications = [];

        return array_values($this->prepare($notifications));
    }

    public function report(RequestInterface $request, ResponseInterface|\Throwable $result): MessageSentReport
    {
        return $result instanceof ResponseInterface
            ? $this->createReport($request, $result)
            : $this->createRejectedReport($request, $result);
    }
}
