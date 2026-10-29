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
        RateLimiter::for('notes', fn (Request $request): array => [
            Limit::perMinute((int) config('notes.rate_per_minute'))->by('notes-minute:'.$request->user()?->getAuthIdentifier()),
            Limit::perDay((int) config('notes.rate_per_day'))->by('notes-day:'.$request->user()?->getAuthIdentifier()),
        ]);
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

        // The reset link opens the app, with the token in the fragment so it never reaches a
        // server log or a Referer (AA §2.3)
        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('app.frontend_url').'/reset-password#'
            .http_build_query(['token' => $token, 'email' => $user->email]));
    }
}
