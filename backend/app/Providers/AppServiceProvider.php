<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\SystemClock;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

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
        RateLimiter::for('forgot-password', fn (Request $request) => [
            Limit::perHour(3)->by('email:'.Str::lower(trim((string) $request->input('email')))),
            Limit::perHour(10)->by('ip:'.$request->ip()),
        ]);
        // Each try checks a hashed token, so cap them; a person fixing a weak password needs only a few
        RateLimiter::for('reset-password', fn (Request $request) => [
            Limit::perMinute(5)->by('ip:'.$request->ip()),
            Limit::perHour(20)->by('ip:'.$request->ip()),
        ]);

        // Everything else: 120/min per user, 300/min per IP for guests
        RateLimiter::for('api', fn (Request $request) => $request->user('sanctum')
            ? Limit::perMinute(120)->by('user:'.$request->user('sanctum')->getAuthIdentifier())
            : Limit::perMinute(300)->by('ip:'.$request->ip()));
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
        RateLimiter::for('sync', fn (Request $request) => Limit::perMinute(30)->by('sync:'.$perUser($request)));

        // The reset link opens the app, with the token in the fragment so it never reaches a
        // server log or a Referer (AA §2.3)
        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('app.frontend_url').'/reset-password#'
            .http_build_query(['token' => $token, 'email' => $user->email]));
    }
}
