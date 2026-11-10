<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

// ASVS 2.2.3: tell the owner, so a change they didn't make doesn't go unnoticed (T-AA-42)
class PasswordChanged extends Notification
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
            ->subject(__('email.changed_subject'))
            ->greeting($greeting)
            ->line(__('email.changed_intro'))
            ->line(__('email.changed_ok'))
            ->line(__('email.changed_not_you'))
            ->action(__('email.changed_action'), config('app.frontend_url').'/forgot-password')
            ->salutation('');

        $mail->viewData['title'] = __('email.changed_heading');

        return $mail;
    }
}
