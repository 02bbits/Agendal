<?php

declare(strict_types=1);

namespace App\Services\Reminders;

use App\Models\PushSubscription;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Psr\Log\LoggerInterface;

class WebPushSender implements ReminderPush
{
    public function __construct(
        private readonly LoggerInterface $logger,
    ) {}

    public function ready(): bool
    {
        $publicKey = config('services.webpush.public_key');
        $privateKey = config('services.webpush.private_key');

        return ! empty($publicKey) && ! empty($privateKey);
    }

    /**
     * @param  list<array{subscription: PushSubscription, payload: array<string, string>}>  $messages
     * @return list<string> endpoints the push service says are gone
     */
    public function send(array $messages): array
    {
        if (empty($messages) || ! $this->ready()) {
            return [];
        }

        $auth = [
            'VAPID' => [
                'subject' => (string) config('services.webpush.subject'),
                'publicKey' => (string) config('services.webpush.public_key'),
                'privateKey' => (string) config('services.webpush.private_key'),
            ],
        ];

        $webPush = new WebPush(
            auth: $auth,
            logger: $this->logger,
        );

        foreach ($messages as $message) {
            $sub = $message['subscription'];
            $subscription = Subscription::create([
                'endpoint' => $sub->endpoint,
                'keys' => $sub->keys,
            ]);
            $webPush->queueNotification($subscription, json_encode($message['payload'], JSON_THROW_ON_ERROR));
        }

        $expiredEndpoints = [];
        $failedCount = 0;

        foreach ($webPush->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                $expiredEndpoints[] = $report->getEndpoint();
            } elseif (! $report->isSuccess()) {
                $failedCount++;
            }
        }

        if ($failedCount > 0) {
            $this->logger->warning('Web push failed reports', ['failed_count' => $failedCount]);
        }

        return $expiredEndpoints;
    }
}
