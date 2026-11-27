<?php

namespace App\Providers;

use App\Exceptions\RateLimited;
use App\Livewire\Pulse\ServerHealth;
use App\Models\User;
use App\Pulse\HostHealth;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\SystemClock;
use App\Services\Monitoring\CriticalErrorAlert;
use App\Services\Monitoring\SlowQueryAlert;
use App\Support\ApiDocs;
use App\Support\EmailInput;
use Closure;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Database\Connection;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Laravel\Pulse\Facades\Pulse;
use Laravel\Pulse\Recorders\Servers;
use Laravel\Sanctum\PersonalAccessToken;
use Livewire\Livewire;

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
        ApiDocs::register();

        // #192 slow-query alert, logged at error and posted to the admins' Discord (#225). SQL only: the
        // bindings carry note and task text (SC-21). request_id comes from Context, like every log line
        $alert = $this->app->make(SlowQueryAlert::class);
        DB::listen(function (QueryExecuted $query) use ($alert) {
            if ($query->time >= config('database.slow_query_ms')) {
                $alert($query->sql, $query->time);
            }
        });
        // A request's queries over slow_request_ms: logged only, Discord is for single slow queries (#225).
        // ponytail: fires once per connection; a long-lived queue worker needs a per-job reset if it matters
        DB::whenQueryingForLongerThan(config('database.slow_request_ms'), function (Connection $connection) {
            Log::error('Slow request queries', ['ms' => $connection->totalQueryDuration()]);
        });
        // The alert names the job it came from; hidden, so log lines stay as they were
        Queue::before(fn (JobProcessing $event) => Context::addHidden('job', 'job '.class_basename($event->job->resolveName())));
        // #228: a job out of attempts, or a failed scheduled task, is posted to the admins' Discord
        Queue::failing(fn (JobFailed $event) => $this->app->make(CriticalErrorAlert::class)->jobFailed($event));
        Event::listen(fn (ScheduledTaskFailed $event) => $this->app->make(CriticalErrorAlert::class)->scheduledTaskFailed($event));

        // #198 /pulse: open locally, elsewhere for Telescope's allow-list. Users show by id only (SC-21)
        Gate::define('viewPulse', fn (?User $user = null) => $this->app->environment('local')
            || in_array($user?->email, config('telescope.allowed_emails'), true));
        Pulse::user(fn (User $user) => ['name' => 'User '.$user->id]);
        // #199 Server health card; the Servers card draws its CPU from the same reading (the image has no `top`)
        Livewire::component('pulse.server-health', ServerHealth::class);
        Servers::detectCpuUsing(fn () => HostHealth::$cpu);
        // Behind the Next.js rewrite the Host is the API container, so links (Livewire's update URL) use APP_URL
        URL::forceRootUrl(config('app.url'));
        URL::forceScheme((string) parse_url(config('app.url'), PHP_URL_SCHEME));

        // NF-13 rate limits. Each 429 names the limit it hit, so the app can tell "too fast" from
        // "too many" (UX-43)
        $limiter = fn (string $name, Closure $limits) => RateLimiter::for($name, fn (Request $request) => array_map(
            fn (Limit $limit) => $limit->response(fn (Request $request, array $headers) => throw new RateLimited($limit->maxAttempts, $limit->decaySeconds, $headers)),
            Arr::wrap($limits($request)),
        ));
        // Create account: 30 presses per 10 minutes per IP, like sign-in's per-IP cap. "5 different
        // emails per hour" counts accounts, not presses (PendingSignup::countAccountTried)
        $limiter('register', fn (Request $request) => Limit::perMinutes(10, 30)->by($request->ip()));

        // Two-factor toggle: 5 per 2 minutes per user
        $limiter('two-factor-toggle', fn (Request $request) => Limit::perMinutes(2, 5)->by('two-factor-toggle:'.$request->user()?->id));
        // Settings > Notifications test push (TK-6): enough to try, not enough to flood a device
        $limiter('push-test', fn (Request $request) => Limit::perMinute(3)->by('push-test:'.$request->user()?->id));

        $limiter('forgot-password', fn (Request $request) => [
            Limit::perHour(3)->by('email:'.EmailInput::key($request)),
            Limit::perHour(10)->by('ip:'.$request->ip()),
        ]);
        // Each try checks a hashed token, so cap them; a person fixing a weak password needs only a few
        $limiter('reset-password', fn (Request $request) => [
            // Each limit its own key, so the minute and hour counters never share one
            Limit::perMinute(5)->by('ip-min:'.$request->ip()),
            Limit::perHour(20)->by('ip-hour:'.$request->ip()),
        ]);

        // Everything else: 150/min plus a 20/s burst cap, per user, per personal access token (#196),
        // or per IP for guests
        $limiter('api', function (Request $request) {
            $user = $request->user('sanctum');
            $token = $user instanceof User ? $user->currentAccessToken() : null;
            $key = match (true) {
                $token instanceof PersonalAccessToken => 'token:'.$token->getKey(),
                $user !== null => 'user:'.$user->getAuthIdentifier(),
                default => 'ip:'.$request->ip(),
            };

            return [
                Limit::perMinute(150)->by('api-min:'.$key),
                Limit::perSecond(20)->by('api-sec:'.$key),
            ];
        });
        // Named for endpoints that arrive later; their owners attach them with throttle:<name>.
        // Each replaces the general limit on its route, so it carries the per-user key itself
        $perUser = fn (Request $request) => 'user:'.($request->user('sanctum')?->getAuthIdentifier() ?? $request->ip());
        $limiter('notes', fn (Request $request) => [
            Limit::perMinute(30)->by('notes-min:'.$perUser($request)),
            Limit::perDay(300)->by('notes-day:'.$perUser($request)),
        ]);
        // Each recording is one model call
        $limiter('dictation', fn (Request $request) => [
            Limit::perMinute(10)->by('dictation-min:'.$perUser($request)),
            Limit::perDay(100)->by('dictation-day:'.$perUser($request)),
        ]);
        $limiter('files', fn (Request $request) => [
            Limit::perHour(10)->by('files-hour:'.$perUser($request)),
            Limit::perDay(30)->by('files-day:'.$perUser($request)),
        ]);
        $limiter('search', fn (Request $request) => Limit::perMinute(60)->by('search:'.$perUser($request)));
        $limiter('search-notes', fn (Request $request) => Limit::perMinute(60)->by('search-notes:'.$perUser($request)));
        $limiter('sync', fn (Request $request) => Limit::perMinute(30)->by('sync:'.$perUser($request)));

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
