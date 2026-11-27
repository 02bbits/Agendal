<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Exceptions\ApiError;
use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use Illuminate\Support\Facades\Cache;

/** Per-user daily calls and a global daily token budget for the model, reserved before each call (ADR-008). */
final class LlmBudget
{
    /** Seconds a budget check may wait for another one to finish. */
    private const LOCK_SECONDS = 5;

    public function __construct(private ClockInterface $clock) {}

    /** The UTC day of a successful reservation, so a late response cannot refund another day's budget. */
    public function reserve(int $userId, int $tokens): string|false
    {
        $day = $this->day();

        return Cache::lock('note-llm:budget:'.$day, self::LOCK_SECONDS)->get(function () use ($userId, $tokens, $day): bool {
            $callsKey = 'note-llm:calls:'.$day.':'.$userId;
            $tokensKey = 'note-llm:tokens:'.$day;
            $calls = (int) Cache::get($callsKey, 0);
            $used = (int) Cache::get($tokensKey, 0);
            if ($calls >= (int) config('note_llm.daily_user_calls') || $used + $tokens > (int) config('note_llm.daily_tokens')) {
                return false;
            }
            Cache::put($callsKey, $calls + 1, $this->untilTomorrow());
            Cache::put($tokensKey, $used + $tokens, $this->untilTomorrow());

            return true;
        }) === true ? $day : false;
    }

    /**
     * A model call that reads a recording or a file (NC §2.3, §2.4): one of the user's daily calls like any other
     * (SC-12), and one at a time per user, since each holds a PHP thread while the model answers. `$call` returns
     * the result and the tokens the provider reported. Another call still running, or a spent budget, answers 429.
     *
     * @template T
     *
     * @param  callable(): array{T, ?int}  $call
     * @return T
     */
    public function spend(int $userId, int $tokens, int $seconds, callable $call): mixed
    {
        $lock = Cache::lock('note-llm:media:'.$userId, $seconds);
        if (! $lock->get()) {
            throw new ApiError('error.rate_limited', 'Another recording or file is still being read.', 429, extra: ['retry_after' => 5]);
        }
        try {
            $day = $this->reserve($userId, $tokens);
            if ($day === false) {
                throw new ApiError('error.rate_limited', "Today's model calls are used up.", 429, extra: ['retry_after' => $this->untilTomorrow()]);
            }
            [$result, $used] = $call();
            $this->settle($tokens, $used ?? $tokens, $day);

            return $result;
        } finally {
            $lock->release();
        }
    }

    /** Replace a reservation with the tokens the provider reported, never more than reserved. */
    public function settle(int $reserved, int $used, string $day): void
    {
        // The old day's counters have expired; leave today's reservations untouched.
        if ($day !== $this->day()) {
            return;
        }
        Cache::lock('note-llm:budget:'.$day, self::LOCK_SECONDS)->get(function () use ($reserved, $used, $day): void {
            $key = 'note-llm:tokens:'.$day;
            $settled = (int) Cache::get($key, 0) - $reserved + min($reserved, max(0, $used));
            Cache::put($key, max(0, $settled), $this->untilTomorrow());
        });
    }

    private function day(): string
    {
        return $this->clock->now()->format('Y-m-d');
    }

    /** Budgets are per day, so their counters expire when the day ends. */
    private function untilTomorrow(): int
    {
        $now = $this->clock->now();

        return max(1, (new DateTimeImmutable($now->format('Y-m-d'), $now->getTimezone()))->modify('+1 day')->getTimestamp() - $now->getTimestamp());
    }
}
