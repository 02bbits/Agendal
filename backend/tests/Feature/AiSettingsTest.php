<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

const GEMINI_KEY = 'AIzaSyTestOnly0000000000000000000000Q7xd';

function geminiModels(): array
{
    return ['data' => [['id' => 'models/gemini-3.5-flash-lite'], ['id' => 'models/gemini-3.7-flash'], ['id' => 'models/text-embedding-004'], ['id' => 'models/gemini-3.5-flash-tts']]];
}

beforeEach(function () {
    Http::preventStrayRequests();
    $this->aiUser = User::factory()->create();
});

it('checks a key with its provider, keeps it encrypted and returns only its last four characters', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(geminiModels())]);

    $this->actingAs($this->aiUser)->putJson('/api/v1/me/ai/keys/gemini', ['key' => ' '.GEMINI_KEY.' '])->assertOk()
        ->assertJsonPath('model', 'gemini:gemini-3.5-flash-lite')
        ->assertJsonPath('providers.0.id', 'gemini')
        ->assertJsonPath('providers.0.last4', 'Q7xd')
        ->assertJsonPath('providers.0.models', ['gemini-3.5-flash-lite', 'gemini-3.7-flash']);

    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer '.GEMINI_KEY));
    expect((string) DB::table('users')->where('id', $this->aiUser->id)->value('llm_keys'))->not->toContain(GEMINI_KEY)
        ->and($this->aiUser->fresh()->llm_keys['gemini']['key'])->toBe(GEMINI_KEY);
    foreach (['/api/v1/me', '/api/v1/me/ai'] as $url) {
        expect($this->getJson($url)->assertOk()->getContent())->not->toContain(GEMINI_KEY);
    }
});

it('refuses a key the provider rejects, limits or can not be reached with, and keeps nothing', function (mixed $answer, string $code) {
    Http::fake(['generativelanguage.googleapis.com/*' => $answer]);

    $this->actingAs($this->aiUser)->putJson('/api/v1/me/ai/keys/gemini', ['key' => GEMINI_KEY])
        ->assertUnprocessable()->assertJsonPath('error.fields.key.0', $code);
    expect($this->aiUser->fresh()->llm_keys)->toBeNull();
})->with([
    'refused' => [fn () => Http::response(['error' => 'bad key'], 400), 'ai.key_invalid'],
    'out of quota' => [fn () => Http::response([], 429), 'ai.key_limited'],
    'no model that can plan a note' => [fn () => Http::response(['data' => [['id' => 'models/text-embedding-004']]]), 'ai.key_no_models'],
    'unreachable' => [fn () => throw new ConnectionException('down'), 'ai.key_unreachable'],
]);

it('checks an OpenRouter key on its own endpoint, since the model list is public', function () {
    Http::fake(['openrouter.ai/api/v1/key' => Http::response([], 401), 'openrouter.ai/*' => Http::response(['data' => [['id' => 'google/gemini-3.5-flash-lite']]])]);

    $this->actingAs($this->aiUser)->putJson('/api/v1/me/ai/keys/openrouter', ['key' => 'sk-or-v1-test-only'])
        ->assertUnprocessable()->assertJsonPath('error.fields.key.0', 'ai.key_invalid');
});

it('picks only a model a saved key can use, turns AI off, and moves the model when its key goes', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response(geminiModels()),
        'openrouter.ai/*' => Http::response(['data' => [['id' => 'openai/gpt-5.4-mini']]]),
    ]);
    $this->actingAs($this->aiUser)->putJson('/api/v1/me/ai/keys/gemini', ['key' => GEMINI_KEY])->assertOk();
    $this->putJson('/api/v1/me/ai/keys/openrouter', ['key' => 'sk-or-v1-test-only'])->assertOk()
        ->assertJsonPath('model', 'gemini:gemini-3.5-flash-lite');

    $this->patchJson('/api/v1/me/ai', ['model' => 'openai:gpt-5.4'])->assertUnprocessable();
    $this->patchJson('/api/v1/me/ai', ['model' => 'gemini:gemini-3.7-flash', 'enabled' => false])->assertOk()
        ->assertJsonPath('model', 'gemini:gemini-3.7-flash')->assertJsonPath('enabled', false);

    $this->deleteJson('/api/v1/me/ai/keys/gemini')->assertNoContent();
    $this->getJson('/api/v1/me/ai')->assertJsonPath('model', 'openrouter:openai/gpt-5.4-mini')->assertJsonPath('providers.0.last4', null);
    $this->deleteJson('/api/v1/me/ai/keys/openrouter')->assertNoContent();
    $this->getJson('/api/v1/me/ai')->assertJsonPath('model', null);
});

it('knows only the configured providers', function () {
    $this->actingAs($this->aiUser)->putJson('/api/v1/me/ai/keys/unknown', ['key' => 'x'])->assertNotFound();
});
