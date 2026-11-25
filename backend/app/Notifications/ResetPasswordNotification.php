<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Notifications\Concerns\QueuedMailNotification;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Queue\ShouldQueue;
use SensitiveParameter;

/** Queues the built-in password reset email with retries, backoff, and redacted failure logging (#193). */
class ResetPasswordNotification extends ResetPassword implements ShouldQueue
{
    use QueuedMailNotification;

    public function __construct(#[SensitiveParameter] string $token)
    {
        parent::__construct($token);
        $this->afterCommit();
    }
}
