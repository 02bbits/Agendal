<?php

declare(strict_types=1);

namespace App\Services\Push;

/**
 * The server's VAPID key pair (RFC 8292, TK §2.5). The private key is read from a secret file
 * (VAPID_PRIVATE_KEY_FILE), never from .env. Without both keys reminders are off: nothing is
 * claimed, so no reminder is lost while the keys are missing.
 */
final class VapidKeys
{
    public function configured(): bool
    {
        return $this->publicKey() !== '' && $this->privateKey() !== '';
    }

    public function publicKey(): string
    {
        return trim((string) config('push.vapid.public_key'));
    }

    /**
     * @return array{VAPID: array{subject: string, publicKey: string, privateKey: string}}
     */
    public function auth(): array
    {
        return ['VAPID' => [
            'subject' => (string) config('push.vapid.subject'),
            'publicKey' => $this->publicKey(),
            'privateKey' => $this->privateKey(),
        ]];
    }

    private function privateKey(): string
    {
        $file = (string) config('push.vapid.private_key_file');

        return $file !== '' && is_file($file) && is_readable($file) ? trim((string) file_get_contents($file)) : '';
    }
}
