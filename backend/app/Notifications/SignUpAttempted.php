<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

// An existing user is alerted when someone tries to create an account with their email (SC-04)
class SignUpAttempted extends Notification
{
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
            ->subject(__('email.signup_attempted_subject'))
            ->greeting($greeting)
            ->line(__('email.signup_attempted_intro'))
            ->line(__('email.signup_attempted_body'))
            ->action(__('email.signup_attempted_action'), (string) config('app.frontend_url').'/sign-in')
            ->line(__('email.signup_attempted_ignore'))
            ->salutation('');

        $mail->viewData['title'] = __('email.signup_attempted_heading');
        $mail->viewData['actionColor'] = 'primary';

        return $mail;
    }
}
