<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

/**
 * A VAPID key pair for reminders (TK-6). The private key is written to a file only (a Docker
 * secret in production), never printed; the public key goes in VAPID_PUBLIC_KEY.
 */
class MakeVapidKeys extends Command
{
    protected $signature = 'push:vapid {file : Where to write the private key, e.g. ../secrets/vapid_private_key}';

    protected $description = 'Make a VAPID key pair for Web Push reminders';

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        if (file_exists($file)) {
            $this->error("{$file} exists already; remove it first to replace the keys.");

            return self::FAILURE;
        }
        $keys = VAPID::createVapidKeys();
        if (file_put_contents($file, $keys['privateKey']) === false) {
            $this->error("Couldn't write {$file}.");

            return self::FAILURE;
        }
        @chmod($file, 0600);
        $this->line('VAPID_PUBLIC_KEY='.$keys['publicKey']);
        $this->line("VAPID_PRIVATE_KEY_FILE=<the path of {$file} as the API sees it>");

        return self::SUCCESS;
    }
}
