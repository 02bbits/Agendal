<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

// An existing user is alerted when someone tries to create an account with their email (SC-04)
class SignUpAttempted extends Notification
{
    public function __construct(
        public readonly ?string $ip = null,
        public readonly ?string $time = null,
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

        $timeStr = $this->time ?? now()->utc()->format('M j, Y, g:i A \U\T\C');
        $ipStr = $this->ip ? ' &bull; IP <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">'.e($this->ip).'</span>' : '';

        $metaHtml = '<p class="meta-line" style="margin: 10px 0 16px; font-size: 13px; color: #545454;">'
            .e($timeStr).$ipStr
            .'</p>';

        $signInUrl = (string) config('app.frontend_url').'/sign-in';
        $resetUrl = (string) config('app.frontend_url').'/forgot-password';

        $mail = (new MailMessage)
            ->subject(__('email.signup_attempted_subject'))
            ->greeting($greeting)
            ->line(__('email.signup_attempted_intro'))
            ->line(new HtmlString($metaHtml))
            ->line(__('email.signup_attempted_if_you', [
                'sign_in_text' => __('email.signup_attempted_sign_in'),
                'sign_in_url' => $signInUrl,
                'reset_text' => __('email.signup_attempted_reset_password'),
                'reset_url' => $resetUrl,
            ]))
            ->line(__('email.signup_attempted_if_not'))
            ->salutation('');

        $mail->viewData['title'] = __('email.signup_attempted_heading');

        return $mail;
    }
}
