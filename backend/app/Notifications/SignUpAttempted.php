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
        $ipStr = $this->ip ?? '—';

        $activityHtml = '<table class="activity-box" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 20px 0; border: 1px solid #E1E1E1; border-radius: 8px; background-color: #FAFAFA;">'
            .'<tr><td style="padding: 14px 16px;">'
            .'<p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #545454;">'.e(__('email.signup_attempted_activity')).'</p>'
            .'<table cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; line-height: 22px; color: #252525;">'
            .'<tr><td class="meta-label" style="padding-right: 14px; color: #545454; font-weight: 500;">'.e(__('email.signup_attempted_time')).':</td><td>'.e($timeStr).'</td></tr>'
            .'<tr><td class="meta-label" style="padding-right: 14px; color: #545454; font-weight: 500;">'.e(__('email.signup_attempted_ip')).':</td><td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">'.e($ipStr).'</td></tr>'
            .'</table>'
            .'</td></tr></table>';

        $signInUrl = (string) config('app.frontend_url').'/sign-in';
        $resetUrl = (string) config('app.frontend_url').'/forgot-password';

        $mail = (new MailMessage)
            ->subject(__('email.signup_attempted_subject'))
            ->greeting($greeting)
            ->line(__('email.signup_attempted_intro'))
            ->line(new HtmlString($activityHtml))
            ->line(__('email.signup_attempted_was_you'))
            ->line(__('email.signup_attempted_yes', [
                'sign_in_text' => __('email.signup_attempted_sign_in'),
                'sign_in_url' => $signInUrl,
                'reset_text' => __('email.signup_attempted_reset_password'),
                'reset_url' => $resetUrl,
            ]))
            ->line(__('email.signup_attempted_no'))
            ->salutation('');

        $mail->viewData['title'] = __('email.signup_attempted_heading');

        return $mail;
    }
}
