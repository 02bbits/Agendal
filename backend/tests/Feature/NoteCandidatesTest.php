<?php

use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\NoteContext;
use App\Services\Notes\TaskCandidates;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

it('searches only owned open tasks and caps candidate retrieval', function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    $owner = User::factory()->create();
    $other = User::factory()->create();
    for ($i = 0; $i < 52; $i++) {
        $task = new Task;
        $task->forceFill(['user_id' => $owner->id, 'title' => 'Bài tập SQL '.$i])->save();
    }
    $foreign = new Task;
    $foreign->forceFill(['user_id' => $other->id, 'title' => 'Bài tập SQL'])->save();
    $done = new Task;
    $done->forceFill(['user_id' => $owner->id, 'title' => 'Bài tập SQL', 'done' => true])->save();
    $candidates = app(TaskCandidates::class)->find($owner->id, ['bài', 'sql']);
    expect($candidates)->toHaveCount(50);
    expect(array_column($candidates, 'user_id'))->each->toBe($owner->id);
    expect(array_column($candidates, 'id'))->not->toContain($done->id, $foreign->id);
});

it('keeps the task holding every word of the command ahead of many one-word look-alikes', function () {
    $owner = User::factory()->create();
    for ($i = 1; $i <= 55; $i++) {
        (new Task)->forceFill(['user_id' => $owner->id, 'title' => 'Report '.$i])->save();
    }
    $annual = new Task;
    $annual->forceFill(['user_id' => $owner->id, 'title' => 'Annual sales report'])->save();

    expect(array_column(app(TaskCandidates::class)->find($owner->id, ['annual', 'sales', 'report']), 'id'))->toContain($annual->id);
});

it('counts whole words only and gives every task a command names its own candidates', function () {
    $owner = User::factory()->create();
    for ($i = 1; $i <= 55; $i++) {
        (new Task)->forceFill(['user_id' => $owner->id, 'title' => 'Buyer red pencil '.$i])->save();
        (new Task)->forceFill(['user_id' => $owner->id, 'title' => 'Report '.$i])->save();
        (new Task)->forceFill(['user_id' => $owner->id, 'title' => 'Send '.$i])->save();
    }
    $invoice = new Task;
    $invoice->forceFill(['user_id' => $owner->id, 'title' => 'Send_invoice'])->save();
    $pen = new Task;
    $pen->forceFill(['user_id' => $owner->id, 'title' => 'Buy a red pen for the office'])->save();
    $gym = new Task;
    $gym->forceFill(['user_id' => $owner->id, 'title' => 'Go to the gym after work'])->save();
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $groups = app(CommandMatcher::class)->candidateWords('move report and gym to friday', $context);

    expect(array_column(app(TaskCandidates::class)->find($owner->id, ['buy', 'red', 'pen']), 'id'))->toContain($pen->id)
        ->and(array_column(app(TaskCandidates::class)->find($owner->id, ['send', 'invoice']), 'id'))->toContain($invoice->id)
        ->and(array_column(app(TaskCandidates::class)->findEach($owner->id, $groups), 'id'))->toContain($gym->id);
});
