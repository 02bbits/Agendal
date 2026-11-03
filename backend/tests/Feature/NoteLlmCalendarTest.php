<?php

use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

it('persists independent model calendar series, replays once and advances the selected weekdays', function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-11-01T15:11:00Z'));
    config(['note_llm.enabled' => true, 'note_llm.key' => 'test-only', 'note_llm.model' => 'test/model', 'note_llm.prompt_version' => 'note-plan-v2']);
    $this->actingAs(User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']));
    Http::preventStrayRequests();
    $response = json_decode(file_get_contents(__DIR__.'/../Fixtures/note-llm-response.json'), true, flags: JSON_THROW_ON_ERROR);
    $items = json_decode($response['choices'][0]['message']['content'], true, flags: JSON_THROW_ON_ERROR);
    $rule = 'FREQ=WEEKLY;BYDAY=MO,WE,FR';
    $items['items'][0] = [...$items['items'][0], 'repeat' => 'weekly', 'repeat_rule' => $rule, 'copies' => 3, 'due_date' => '2026-11-02'];
    $response['choices'][0]['message']['content'] = json_encode($items, JSON_THROW_ON_ERROR);
    Http::fake(['openrouter.ai/*' => Http::response($response)]);
    $input = ['client_id' => (string) Str::uuid(), 'text' => 'toi can mua sua', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];

    $created = $this->postJson('/api/v1/notes', $input)->assertCreated()
        ->assertJsonPath('note.engine', 'rules_llm')->assertJsonPath('note.status', 'done')->assertJsonCount(3, 'changes');
    $id = $created->json('changes.0.task.id');
    expect(Task::count())->toBe(3)
        ->and(Task::findOrFail($id)->repeat_rule)->toBe($rule)
        ->and(Task::findOrFail($id)->repeat_anchor)->toBe('2026-11-02');
    $this->postJson('/api/v1/notes', $input)->assertOk()->assertJsonPath('changes.0.task.id', $id);
    expect(Task::count())->toBe(3);
    Http::assertSentCount(1);

    $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()
        ->assertJsonPath('next.due_date', '2026-11-04')->assertJsonPath('next.repeat_rule', $rule);
});
