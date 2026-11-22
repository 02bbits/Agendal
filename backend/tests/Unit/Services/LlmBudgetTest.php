<?php

use App\Services\Clock\ClockInterface;
use App\Services\Notes\LlmBudget;
use Illuminate\Support\Facades\Cache;
use Tests\Support\FrozenClock;
use Tests\TestCase;

uses(TestCase::class);

it('does not refund yesterday into todays token budget when a request crosses midnight', function () {
    $clock = new FrozenClock('2026-10-23T23:59:59Z');
    app()->instance(ClockInterface::class, $clock);
    config(['note_llm.daily_tokens' => 1000, 'note_llm.daily_user_calls' => 20]);
    Cache::flush();
    $budget = app(LlmBudget::class);
    $reservation = $budget->reserve(1, 400);
    expect($reservation)->not->toBeFalse();
    $clock->advance('+2 seconds');
    expect($budget->reserve(2, 400))->not->toBeFalse();

    $budget->settle(400, 100, $reservation);

    expect($budget->reserve(3, 601))->toBeFalse();
});

it('refunds unused tokens on the reservation day without refunding the user call', function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T12:00:00Z'));
    config(['note_llm.daily_tokens' => 1000, 'note_llm.daily_user_calls' => 1]);
    Cache::flush();
    $budget = app(LlmBudget::class);
    $reservation = $budget->reserve(1, 400);
    expect($reservation)->not->toBeFalse();

    $budget->settle(400, 100, $reservation);

    expect($budget->reserve(1, 1))->toBeFalse()
        ->and($budget->reserve(2, 900))->not->toBeFalse()
        ->and($budget->reserve(3, 1))->toBeFalse();
});
