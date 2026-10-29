<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

// IM-12: POST /auth/login (AA-2, AA-3, ADR-007)
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
    $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'quiet river 42']);
});

function login(array $overrides = [], string $ip = '10.0.0.1'): TestResponse
{
    newRequest();

    return test()->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/v1/auth/login', array_merge([
        'email' => 'example@gmail.com', 'password' => 'quiet river 42', 'remember' => true,
    ], $overrides));
}

function wrongPassword(string $ip = '10.0.0.1', string $email = 'example@gmail.com'): TestResponse
{
    return login(['email' => $email, 'password' => 'not my password'], $ip)->assertStatus(422);
}

it('signs in with a new session ID and returns the user', function () {
    $before = carryCookies($this->get('/sanctum/csrf-cookie'))[SESSION_COOKIE];

    $response = login(['email' => ' Example@Gmail.com'])->assertOk()->assertJsonPath('user.email', 'example@gmail.com');

    expect(carryCookies($response)[SESSION_COOKIE])->not->toBe($before) // SEC-04
        ->and(collect($response->headers->getCookies())->contains(fn ($c) => str_starts_with($c->getName(), 'remember_web_')))->toBeTrue()
        ->and(DB::table('audit_events')->where('user_id', $this->user->id)->value('event'))->toBe('sign_in');
});

it('refuses a request from outside the app, which has no session', function () {
    $this->withHeader('Referer', 'https://elsewhere.example/');

    login()->assertForbidden()->assertJsonPath('error.code', 'error.generic');
});

it('without Remember me sets no remember cookie', function () {
    $response = login(['remember' => false])->assertOk();

    expect(collect($response->headers->getCookies())->contains(fn ($c) => str_starts_with($c->getName(), 'remember_web_')))->toBeFalse();
});

it('T-AA-10, SEC-08: a wrong password and an unknown email get the same answer', function () {
    $wrong = wrongPassword()->json('error');
    $unknown = login(['email' => 'nobody@gmail.com'])->assertStatus(422)->json('error');

    expect($wrong['code'])->toBe('auth.invalid')
        ->and($wrong['message'])->toBe('Email or password is incorrect.')
        ->and([$unknown['code'], $unknown['message']])->toBe([$wrong['code'], $wrong['message']]);
});

describe('lockout', function () {
    // Each failure waits out Laravel's 200 ms sign-in padding; the limits don't need it
    beforeEach(fn () => config(['auth.timebox_duration' => 0]));

    it('T-AA-20, SEC-05: locks (email, IP) for 60 s after 3 failures, even for the right password', function () {
        wrongPassword();
        wrongPassword();
        wrongPassword();

        login()->assertStatus(429)->assertHeader('Retry-After', '60')
            ->assertJsonPath('error.code', 'auth.locked')->assertJsonPath('error.retry_after', 60);

        $this->travel(61)->seconds();
        login()->assertOk();
    });

    it('SEC-07: a lock on one IP leaves the same email working from another IP', function () {
        foreach (range(1, 3) as $i) {
            wrongPassword('10.0.0.1');
        }

        login([], '10.0.0.1')->assertStatus(429);
        login([], '10.0.0.2')->assertOk();
    });

    it('locks an email for 15 min after 20 failures across IPs', function () {
        foreach (range(1, 20) as $i) {
            wrongPassword("10.0.1.{$i}");
        }

        login([], '10.0.2.1')->assertStatus(429)->assertJsonPath('error.retry_after', 900);
    });

    it('allows 30 attempts per IP per 10 min across all emails', function () {
        foreach (range(1, 30) as $i) {
            wrongPassword('10.0.0.9', "user{$i}@gmail.com");
        }

        login(['email' => 'someone@gmail.com'], '10.0.0.9')->assertStatus(429)->assertJsonPath('error.code', 'auth.locked');
    });

    it('records failures and the lockout in the audit log', function () {
        foreach (range(1, 3) as $i) {
            wrongPassword();
        }

        expect(DB::table('audit_events')->where('user_id', $this->user->id)->pluck('event')->all())
            ->toBe(['sign_in_failed', 'sign_in_failed', 'sign_in_failed', 'lockout']);
    });
});
