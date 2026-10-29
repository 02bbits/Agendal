<?php

use App\Services\Clock\ClockInterface;
use App\Services\Clock\SystemClock;
use Tests\Support\FrozenClock;

test('Laravel resolves one system clock and allows a frozen clock to be injected', function () {
    $clock = app(ClockInterface::class);
    expect($clock)->toBeInstanceOf(SystemClock::class)
        ->and(app(ClockInterface::class))->toBe($clock);

    $frozen = new FrozenClock('2026-10-23T08:12:00+07:00');
    $this->app->instance(ClockInterface::class, $frozen);

    expect(app(ClockInterface::class)->today('Asia/Ho_Chi_Minh'))->toBe('2026-10-23');
});
