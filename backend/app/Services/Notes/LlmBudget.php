<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Services\Clock\ClockInterface;
use Illuminate\Support\Facades\Cache;

final class LlmBudget
{
    public function __construct(private ClockInterface $clock) {}

    public function reserve(int $userId, int $tokens): bool
    {
        $day = $this->clock->now()->format('Y-m-d');

        return Cache::lock('note-llm:budget:'.$day, 5)->get(function () use ($userId, $tokens, $day): bool {
            $userKey = 'note-llm:calls:'.$day.':'.$userId;
            $tokenKey = 'note-llm:tokens:'.$day;
            $calls = (int) Cache::get($userKey, 0);
            $used = (int) Cache::get($tokenKey, 0);
            if ($calls >= (int) config('note_llm.daily_user_calls') || $used + $tokens > (int) config('note_llm.daily_tokens')) {
                return false;
            }
            Cache::put($userKey, $calls + 1, 86400);
            Cache::put($tokenKey, $used + $tokens, 86400);

            return true;
        }) === true;
    }

    public function settle(int $reserved, int $used): void
    {
        $day = $this->clock->now()->format('Y-m-d');
        Cache::lock('note-llm:budget:'.$day, 5)->get(function () use ($reserved, $used, $day): void {
            $key = 'note-llm:tokens:'.$day;
            Cache::put($key, max(0, (int) Cache::get($key, 0) - $reserved + min($reserved, max(0, $used))), 86400);
        });
    }
}
