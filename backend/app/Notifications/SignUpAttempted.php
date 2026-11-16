<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

// An existing user is told when someone tries to create an account with their email (SC-04).
// No IP or time: the mail only says the account exists and where to sign in.
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

        $frontend = (string) config('app.frontend_url');

        $mail = (new MailMessage)
            ->subject(__('email.signup_attempted_subject'))
            ->greeting($greeting)
            ->line(__('email.signup_attempted_intro'))
            ->line(__('email.signup_attempted_continue', [
                'login_text' => __('email.signup_attempted_login'),
                'login_url' => $frontend.'/sign-in',
            ]))
            ->line(__('email.signup_attempted_forgot', [
                'reset_text' => __('email.signup_attempted_reset'),
                'reset_url' => $frontend.'/forgot-password',
            ]))
            ->salutation('');

        $mail->viewData['title'] = __('email.signup_attempted_heading');

        return $mail;
    }
}
