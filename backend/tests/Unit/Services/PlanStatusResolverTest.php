<?php

use App\Enums\PlanStatus;
use App\Enums\SkipReason;
use App\Services\Notes\PlanStatusResolver;
use Tests\TestCase;

uses(TestCase::class);

it('picks the plan status in the NU §2.6 order (T-NU-33, T-NU-40, T-NU-41)', function (int $changes, bool $delete, bool $tie, array $skips, PlanStatus $status) {
    expect((new PlanStatusResolver)->resolve($changes, $delete, $tie, $skips))->toBe($status);
})->with([
    'any delete → confirm' => [1, true, false, [], PlanStatus::Confirm],
    'a tie → confirm' => [0, false, true, [], PlanStatus::Confirm],
    '6 changes → confirm' => [6, false, false, [], PlanStatus::Confirm],
    '5 changes → done' => [5, false, false, [], PlanStatus::Done],
    'changes beat skips' => [1, false, false, [SkipReason::Skip], PlanStatus::Done],
    'only unmatched commands → done' => [0, false, false, [SkipReason::AlreadyDone, SkipReason::NotFound], PlanStatus::Done],
    'a plain skip → followup' => [0, false, false, [SkipReason::NotFound, SkipReason::Skip], PlanStatus::Followup],
    'only skips → followup' => [0, false, false, [SkipReason::Skip], PlanStatus::Followup],
]);

it('reads the confirm threshold from config (BR-01)', function () {
    config(['notes.changes_before_confirm' => 2]);

    expect((new PlanStatusResolver)->resolve(3, false, false, []))->toBe(PlanStatus::Confirm);
});
