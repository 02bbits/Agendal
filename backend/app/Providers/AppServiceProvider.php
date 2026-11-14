<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\SystemClock;
use App\Support\EmailInput;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ClockInterface::class, SystemClock::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // NF-13 rate limits
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(5)->by($request->ip()));

        // Two-factor toggle: 5 per 2 minutes per user
        RateLimiter::for('two-factor-toggle', fn (Request $request) => Limit::perMinutes(2, 5)->by('two-factor-toggle:'.$request->user()?->id));

        RateLimiter::for('forgot-password', fn (Request $request) => [
            Limit::perHour(3)->by('email:'.EmailInput::key($request)),
            Limit::perHour(10)->by('ip:'.$request->ip()),
        ]);
        // Each try checks a hashed token, so cap them; a person fixing a weak password needs only a few
        RateLimiter::for('reset-password', fn (Request $request) => [
            // Each limit its own key, so the minute and hour counters never share one
            Limit::perMinute(5)->by('ip-min:'.$request->ip()),
            Limit::perHour(20)->by('ip-hour:'.$request->ip()),
        ]);

        // Everything else: 300/min plus a 20/s burst cap, per user, or per IP for guests
        RateLimiter::for('api', function (Request $request) {
            $key = ($user = $request->user('sanctum')) ? 'user:'.$user->getAuthIdentifier() : 'ip:'.$request->ip();

            return [
                Limit::perMinute(300)->by('api-min:'.$key),
                Limit::perSecond(20)->by('api-sec:'.$key),
            ];
        });
        // Named for endpoints that arrive later; their owners attach them with throttle:<name>.
        // Each replaces the general limit on its route, so it carries the per-user key itself
        $perUser = fn (Request $request) => 'user:'.($request->user('sanctum')?->getAuthIdentifier() ?? $request->ip());
        RateLimiter::for('notes', fn (Request $request) => [
            Limit::perMinute(30)->by('notes-min:'.$perUser($request)),
            Limit::perDay(300)->by('notes-day:'.$perUser($request)),
        ]);
        RateLimiter::for('files', fn (Request $request) => [
            Limit::perHour(10)->by('files-hour:'.$perUser($request)),
            Limit::perDay(30)->by('files-day:'.$perUser($request)),
        ]);
        RateLimiter::for('search', fn (Request $request) => Limit::perMinute(60)->by('search:'.$perUser($request)));
        RateLimiter::for('search-notes', fn (Request $request) => Limit::perMinute(60)->by('search-notes:'.$perUser($request)));
        RateLimiter::for('sync', fn (Request $request) => Limit::perMinute(30)->by('sync:'.$perUser($request)));

        // The reset link opens the app, with the token in the fragment so it never reaches a
        // server log or a Referer (AA §2.3)
        $resetUrl = fn (User $user, string $token): string => config('app.frontend_url').'/reset-password#'
            .http_build_query(['token' => $token, 'email' => $user->email]);
        ResetPassword::createUrlUsing($resetUrl);

        ResetPassword::toMailUsing(function (User $user, string $token) use ($resetUrl) {
            $url = $resetUrl($user, $token);

            $greeting = filled($user->display_name)
                ? __('email.greeting', ['name' => $user->display_name])
                : __('email.greeting_plain');

            $mail = (new MailMessage)
                ->subject(__('email.reset_subject'))
                ->greeting($greeting)
                ->line(__('email.reset_intro'))
                ->action(__('email.reset_action'), $url)
                ->line(__('email.reset_expiry'))
                ->line(__('email.reset_ignore'))
                ->salutation('');

            $mail->viewData['title'] = __('email.reset_heading');

            return $mail;
        });
    }
}
