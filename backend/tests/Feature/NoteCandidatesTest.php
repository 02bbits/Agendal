<?php

use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
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
