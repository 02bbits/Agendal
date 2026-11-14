<?php

declare(strict_types=1);

namespace Tests\Support;

use DateTimeImmutable;
use Illuminate\Support\Carbon;

/**
 * A FrozenClock that also moves Laravel's own time, so route rate limits (which count with
 * Carbon) follow the same clock as the code-sending rules in auth tests.
 */
class RateLimitedClock extends FrozenClock
{
    public function __construct(string|DateTimeImmutable $initialTime)
    {
        parent::__construct($initialTime);
        Carbon::setTestNow($this->now());
    }

    public function advance(string $intervalSpec): void
    {
        parent::advance($intervalSpec);
        Carbon::setTestNow($this->now());
    }

    public function setTime(string|DateTimeImmutable $time): void
    {
        parent::setTime($time);
        Carbon::setTestNow($this->now());
    }
}
