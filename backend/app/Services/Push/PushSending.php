<?php

declare(strict_types=1);

namespace App\Services\Push;

use App\Models\PushSubscription;
use GuzzleHttp\Psr7\HttpFactory;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Psr\Http\Message\ResponseInterface;

/**
 * Sends pushes to devices and says how each went (TK §2.5), for reminders and the test from
 * Settings alike. Encrypted and signed one at a time (one broken subscription can't stop the
 * others), sent all at once through PushClient. A device the push service says is gone
 * (404/410) is deleted here.
 */
class PushSending
{
    public const SENT = 'sent';

    public const GONE = 'gone';

    /** 429, 5xx or no answer: worth trying again */
    public const TEMPORARY = 'temporary';

    /** Any other answer, or a subscription that couldn't be encrypted for */
    public const REFUSED = 'refused';

    public function __construct(
        private readonly VapidKeys $keys,
        private readonly PushClient $client,
    ) {}

    /**
     * @param  list<array{device: PushSubscription, payload: string, options: array<string, mixed>}>  $pushes
     * @return list<string> one outcome per push, in order
     */
    public function send(array $pushes): array
    {
        if ($pushes === []) {
            return [];
        }
        $encoder = new PushEncoder($this->keys->auth(), [], $this->client->client(), new HttpFactory, new HttpFactory);
        $outcomes = array_fill(0, count($pushes), self::REFUSED);
        $requests = [];
        foreach ($pushes as $i => $push) {
            try {
                $encoder->queueNotification(Subscription::create([
                    'endpoint' => $push['device']->endpoint,
                    'publicKey' => $push['device']->keys['p256dh'] ?? '',
                    'authToken' => $push['device']->keys['auth'] ?? '',
                    'contentEncoding' => 'aes128gcm',
                ]), $push['payload'], $push['options']);
                $request = $encoder->takeRequests()[0] ?? null;
                if ($request !== null) {
                    $requests[$i] = $request;
                }
            } catch (\Throwable $e) {
                Log::warning('push.encrypt_failed', ['subscription' => $push['device']->id, 'error' => $e->getMessage()]);
            }
        }

        $results = $this->client->sendAll(array_values($requests));
        $gone = [];
        foreach (array_keys($requests) as $n => $i) {
            $result = $results[$n] ?? new \RuntimeException('No response');
            $report = $encoder->report($requests[$i], $result);
            $outcomes[$i] = match (true) {
                $report->isSuccess() => self::SENT,
                $report->isSubscriptionExpired() => self::GONE,
                self::temporary($result) => self::TEMPORARY,
                default => self::REFUSED,
            };
            if ($outcomes[$i] === self::GONE) {
                $gone[] = $pushes[$i]['device']->endpoint;
            } elseif ($outcomes[$i] === self::REFUSED) {
                Log::warning('push.refused', ['status' => $result instanceof ResponseInterface ? $result->getStatusCode() : null]);
            }
        }
        if ($gone !== []) {
            PushSubscription::query()->whereIn('endpoint', $gone)->delete();
        }

        return array_values($outcomes);
    }

    private static function temporary(ResponseInterface|\Throwable $result): bool
    {
        if ($result instanceof \Throwable) {
            return true;
        }
        $status = $result->getStatusCode();

        return $status === 429 || $status >= 500;
    }
}
