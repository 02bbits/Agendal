<?php

namespace App\Notifications;

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
        return (new MailMessage)
            ->subject('Your password was changed')
            ->line('The password for your Agendal account was just changed, and your other devices were signed out.')
            ->line("If you didn't do this, reset your password now from the Sign in screen.");
    }
}
