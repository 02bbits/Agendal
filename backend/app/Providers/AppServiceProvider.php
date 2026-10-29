<?php

namespace App\Providers;

use App\Services\Clock\ClockInterface;
use App\Services\Clock\SystemClock;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
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
    }
}
