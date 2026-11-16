<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

class SignInCode extends Notification
{
    public function __construct(
        public readonly string $code,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $greeting = ($notifiable instanceof User && filled($notifiable->display_name))
            ? __('email.greeting', ['name' => $notifiable->display_name])
            : __('email.greeting_plain');

        $mail = (new MailMessage)
            ->subject(__('email.signin_subject'))
            ->greeting($greeting)
            ->line(__('email.signin_intro'))
            ->line(new HtmlString('<div class="code-box">'.e($this->code).'</div>'))
            ->line(__('email.signin_expiry'))
            ->line(__('email.signin_ignore'))
            ->salutation('');

        $mail->viewData['title'] = __('email.signin_heading');

        return $mail;
    }
}
