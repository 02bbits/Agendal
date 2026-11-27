<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QueuedMailNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;
use Illuminate\Support\Str;

class VerifyEmailCode extends Notification implements ShouldQueue
{
    use QueuedMailNotification;

    public function __construct(
        public readonly string $code,
    ) {
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = null;
        if ($notifiable instanceof User && filled($notifiable->display_name)) {
            $name = $notifiable->display_name;
        } elseif ($notifiable instanceof User && filled($notifiable->email)) {
            $name = Str::before($notifiable->email, '@');
        } elseif (isset($notifiable->routes['mail']) && filled($notifiable->routes['mail'])) {
            $name = Str::before((string) $notifiable->routes['mail'], '@');
        }

        $greeting = filled($name)
            ? __('email.greeting', ['name' => $name])
            : __('email.greeting_plain');

        $mail = (new MailMessage)
            ->subject(__('email.verify_subject'))
            ->greeting($greeting)
            ->line(__('email.verify_intro'))
            ->line(new HtmlString('<div class="code-box">'.e($this->code).'</div>'))
            ->line(__('email.verify_expiry'))
            ->line(__('email.verify_ignore'))
            ->salutation('');

        $mail->viewData['title'] = __('email.verify_heading');

        return $mail;
    }
}
