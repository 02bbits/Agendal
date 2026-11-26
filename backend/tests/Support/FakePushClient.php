<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Push\PushClient;
use GuzzleHttp\Psr7\Response;
use Psr\Http\Message\RequestInterface;
use Throwable;

/** Records what would go to the push services and answers with a status per endpoint. */
class FakePushClient extends PushClient
{
    /** @var list<RequestInterface> */
    public array $sent = [];

    /** @var array<string, int|Throwable> */
    public array $answers = [];

    public function sendAll(array $requests): array
    {
        $this->sent = [...$this->sent, ...$requests];

        return array_map(function ($request) {
            $answer = $this->answers[(string) $request->getUri()] ?? 201;

            return $answer instanceof Throwable ? $answer : new Response($answer);
        }, $requests);
    }
}
