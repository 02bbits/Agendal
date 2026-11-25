<?php

use App\Models\Project;
use App\Models\Task;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

// The demo seed runs on every API container start (docker/api/start.sh): reseeding after a demo
// project was deleted must not leave tasks in a project no list shows
uses(RefreshDatabase::class);

// #194: the seed builds tasks with the factory, which sets what the API would
it('seeds the demo lists with the fields the API sets', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    $tasks = Task::withoutGlobalScope('owner')->get();
    expect($tasks)->toHaveCount(34)
        ->and($tasks->where('done', true))->toHaveCount(6)
        ->and(Project::withoutGlobalScope('owner')->count())->toBe(5)
        ->and($tasks->where('reminder', '!=', 'none')->whereNull('remind_at'))->toBeEmpty()
        ->and($tasks->where('repeat', '!=', 'never')->whereNull('repeat_anchor'))->toBeEmpty()
        ->and($tasks->filter(fn (Task $task): bool => ! isset($task->field_updated_at['title'])))->toBeEmpty();
});

it('a reseed brings back a deleted demo project, so no task points at a deleted one', function () {
    $this->seed(DatabaseSeeder::class);
    $advWeb = Project::withoutGlobalScope('owner')->where('name', 'Adv Web')->firstOrFail();
    $advWeb->forceFill(['deleted_at' => now()])->save();

    $this->seed(DatabaseSeeder::class);

    $advWeb->refresh();
    expect($advWeb->deleted_at)->toBeNull()
        ->and($advWeb->field_updated_at)->toHaveKey('deleted')
        ->and(Task::withoutGlobalScope('owner')->where('project_id', $advWeb->id)->exists())->toBeTrue()
        ->and(Task::withoutGlobalScope('owner')
            ->whereIn('project_id', Project::withoutGlobalScope('owner')->whereNotNull('deleted_at')->select('id'))
            ->exists())->toBeFalse();
});
