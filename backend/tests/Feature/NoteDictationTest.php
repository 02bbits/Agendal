<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Testing\TestResponse;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

const DICTATION = '/api/v1/notes/dictation';
const DICTATION_DAY = '2026-11-27';

/** A second of silence as the recorder writes it: 16 kHz mono 16-bit PCM. */
function dictationWav(): UploadedFile
{
    $samples = 16000;

    return UploadedFile::fake()->createWithContent('dictation.wav', 'RIFF'.pack('V', 36 + $samples * 2).'WAVE'
        .'fmt '.pack('VvvVVvv', 16, 1, 1, 16000, 32000, 2, 16)
        .'data'.pack('V', $samples * 2).str_repeat("\0\0", $samples));
}

/** The model on, answering `$answer` with `$tokens` used; null fakes nothing. */
function dictationModel(?array $answer, int $tokens = 900): void
{
    config(['note_llm.enabled' => true, 'note_llm.provider' => 'gemini', 'note_llm.daily_user_calls' => 20,
        'note_llm.key_file' => tap(tempnam(sys_get_temp_dir(), 'llm'), fn (string $file) => file_put_contents($file, 'test-only'))]);
    if ($answer !== null) {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'choices' => [['message' => ['content' => json_encode($answer)]]],
            'usage' => ['total_tokens' => $tokens],
        ])]);
    }
}

function dictate(): TestResponse
{
    return test()->post(DICTATION, ['audio' => dictationWav()], ['Accept' => 'application/json']);
}

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock(DICTATION_DAY.'T08:00:00Z'));
    Cache::flush();
    $this->user = User::factory()->create(['email_verified_at' => now()]);
    $this->actingAs($this->user);
});

it('refuses a guest', function () {
    auth()->forgetGuards();
    $this->app['auth']->guard('web')->logout();

    $this->postJson(DICTATION)->assertUnauthorized();
});

it('accepts only a WAV recording', function () {
    dictationModel(['speech' => true, 'text' => 'call mum']);

    $this->post(DICTATION, ['audio' => UploadedFile::fake()->createWithContent('note.txt', 'call mum')], ['Accept' => 'application/json'])
        ->assertUnprocessable();
    Http::assertNothingSent();
});

it('answers note.dictation_failed when the model is off', function () {
    config(['note_llm.enabled' => false]);

    dictate()->assertStatus(503)->assertJsonPath('error.code', 'note.dictation_failed');
});

it('writes down the words, as one of the user\'s daily model calls (SC-12)', function () {
    dictationModel(['speech' => true, 'text' => ' gọi mẹ 5 giờ chiều ']);

    dictate()->assertOk()->assertJsonPath('text', 'gọi mẹ 5 giờ chiều');

    Http::assertSent(fn ($request) => $request['messages'][0]['content'][1]['type'] === 'input_audio');
    expect(Cache::get('note-llm:calls:'.DICTATION_DAY.':'.$this->user->id))->toBe(1)
        // The reservation settles to the tokens the provider reported
        ->and(Cache::get('note-llm:tokens:'.DICTATION_DAY))->toBe(900);
});

it('gives no words when the model heard no speech', function () {
    dictationModel(['speech' => false, 'text' => 'made up']);

    dictate()->assertOk()->assertJsonPath('text', '');
});

it('answers note.dictation_failed when the provider fails, logging no words', function () {
    dictationModel(null);
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => 'refused'], 400)]);
    Log::spy();

    dictate()->assertStatus(502)->assertJsonPath('error.code', 'note.dictation_failed');

    Log::shouldHaveReceived('warning')->withArgs(fn (string $event, array $context): bool => $event === 'note_dictation' && $context['status'] === 400);
});

it('answers 429 without calling the model once the day\'s calls are spent', function () {
    dictationModel(['speech' => true, 'text' => 'call mum']);
    config(['note_llm.daily_user_calls' => 1]);
    dictate()->assertOk();

    dictate()->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited')
        ->assertHeader('Retry-After', (string) (16 * 3600));
    Http::assertSentCount(1);
});

it('answers 429 while another of the user\'s recordings or files is being read', function () {
    dictationModel(['speech' => true, 'text' => 'call mum']);
    $running = Cache::lock('note-llm:media:'.$this->user->id, 60);
    $running->get();

    dictate()->assertStatus(429)->assertJsonPath('error.code', 'error.rate_limited');
    Http::assertNothingSent();

    $running->release();
    dictate()->assertOk();
});
