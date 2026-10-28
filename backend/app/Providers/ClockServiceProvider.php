<?php

declare(strict_types=1);

namespace App\Providers;

use App\Services\Clock\ClockInterface;
use App\Services\Clock\SystemClock;
use Illuminate\Support\ServiceProvider;

class ClockServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ClockInterface::class, function () {
            return new SystemClock();
        });
    }
}
