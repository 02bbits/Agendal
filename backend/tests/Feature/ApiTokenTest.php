<?php

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

// #196: personal access tokens with abilities, for API clients other than the app
uses(RefreshDatabase::class);

beforeEach(function () {
    Notification::fake();
    Http::fake(['api.pwnedpasswords.com/*' => Http::response('0000000000000000000000000000000000A:3')]);
    $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'old password 1']);
});

const ALL_ABILITIES = ['tasks:read', 'tasks:write', 'projects:read', 'projects:write', 'notes:read', 'notes:write'];

// A script's request: a Bearer token, no session
function bearer(array $abilities, ?DateTimeInterface $expires = null): TestCase
{
    newRequest();

    return test()->withToken(test()->user->createToken('script', $abilities, $expires ?? now()->addDays(30))->plainTextToken);
}

function asApp(): TestCase
{
    newRequest();

    return test()->withoutToken()->actingAs(test()->user);
}

function notAllowed(TestResponse $response): void
{
    $response->assertForbidden()->assertJsonPath('error.code', 'auth.token_not_allowed');
}

it('lets a token do only what its abilities allow, per group', function () {
    $task = fn () => ['id' => (string) Str::uuid(), 'title' => 'Call the bank'];
    $project = fn () => ['id' => (string) Str::uuid(), 'name' => 'Home', 'colour' => 'blue'];

    bearer(['tasks:read'])->getJson('/api/v1/tasks?view=inbox')->assertOk();
    bearer(['tasks:read'])->getJson('/api/v1/counts')->assertOk();
    notAllowed(bearer(['tasks:read'])->postJson('/api/v1/tasks', $task()));
    bearer(['tasks:write'])->postJson('/api/v1/tasks', $task())->assertCreated();
    notAllowed(bearer(['tasks:write'])->getJson('/api/v1/tasks?view=inbox'));

    bearer(['projects:read'])->getJson('/api/v1/projects')->assertOk();
    notAllowed(bearer(['projects:read'])->postJson('/api/v1/projects', $project()));
    bearer(['projects:write'])->postJson('/api/v1/projects', $project())->assertCreated();
    notAllowed(bearer(['tasks:read', 'tasks:write'])->getJson('/api/v1/projects'));

    $note = ['client_id' => (string) Str::uuid(), 'text' => 'buy milk', 'written_at' => now()->toIso8601String(), 'timezone' => 'UTC'];
    bearer(['notes:read'])->getJson('/api/v1/notes')->assertOk();
    notAllowed(bearer(['notes:read'])->postJson('/api/v1/notes', $note));
    $id = bearer(['notes:write'])->postJson('/api/v1/notes', $note)->assertCreated()->json('note.id');
    // Applying a note changes tasks, so it needs tasks:write too
    notAllowed(bearer(['notes:write'])->postJson("/api/v1/notes/{$id}/apply"));
    expect(bearer(['notes:write', 'tasks:write'])->postJson("/api/v1/notes/{$id}/apply")->status())->not->toBe(403);

    bearer(['tasks:read', 'projects:read', 'notes:read'])->getJson('/api/v1/sync')->assertOk();
    notAllowed(bearer(['tasks:read'])->getJson('/api/v1/sync'));
    notAllowed(bearer(['tasks:write'])->postJson('/api/v1/sync/patches', []));
});

it('keeps account and device routes to the session', function () {
    bearer(ALL_ABILITIES)->getJson('/api/v1/me')->assertOk();
    notAllowed(bearer(ALL_ABILITIES)->patchJson('/api/v1/me', ['display_name' => 'Script']));
    notAllowed(bearer(ALL_ABILITIES)->postJson('/api/v1/auth/logout-everywhere'));
    notAllowed(bearer(ALL_ABILITIES)->postJson('/api/v1/auth/change-password'));
    notAllowed(bearer(ALL_ABILITIES)->getJson('/api/v1/push-subscriptions/key'));
    // A token can't make, list or revoke tokens
    notAllowed(bearer(ALL_ABILITIES)->postJson('/api/v1/tokens', ['name' => 'more', 'abilities' => ['tasks:read']]));
    notAllowed(bearer(ALL_ABILITIES)->getJson('/api/v1/tokens'));
});

it('still answers 404 for someone else\'s ids', function () {
    $other = User::factory()->create();
    $theirTask = Task::factory()->create(['user_id' => $other->id]);
    $theirToken = $other->createToken('theirs', ['tasks:read'])->accessToken;

    bearer(ALL_ABILITIES)->getJson("/api/v1/tasks/{$theirTask->id}")->assertNotFound()->assertJsonPath('error.code', 'error.not_found');
    asApp()->deleteJson("/api/v1/tokens/{$theirToken->id}")->assertNotFound();
    expect($other->tokens()->count())->toBe(1);
});

it('makes a token once with its secret, lists it without, and revokes it', function () {
    $made = asApp()->postJson('/api/v1/tokens', ['name' => 'Backup script', 'abilities' => ['tasks:read', 'notes:read']])
        ->assertCreated()
        ->assertJsonPath('token.name', 'Backup script')
        ->assertJsonPath('token.abilities', ['tasks:read', 'notes:read']);
    // `{id}|agendal_…`: the prefix lets secret scanners spot a leaked token
    expect($made->json('plain_text_token'))->toContain('|agendal_')
        // 30 days unless chosen
        ->and(substr($made->json('token.expires_at'), 0, 10))->toBe(now()->addDays(30)->toDateString());

    newRequest();
    $this->withToken($made->json('plain_text_token'))->getJson('/api/v1/tasks?view=inbox')->assertOk();

    $list = asApp()->getJson('/api/v1/tokens')->assertOk();
    expect($list->getContent())->not->toContain($made->json('plain_text_token'));
    $list->assertJsonPath('0.id', $made->json('token.id'));

    asApp()->deleteJson('/api/v1/tokens/'.$made->json('token.id'))->assertNoContent();
    newRequest();
    $this->withToken($made->json('plain_text_token'))->getJson('/api/v1/tasks?view=inbox')->assertUnauthorized();
});

it('takes 7, 30 or 90 days and only known abilities', function () {
    asApp()->postJson('/api/v1/tokens', ['name' => 'x', 'abilities' => ['tasks:read'], 'expires_in_days' => 365])->assertUnprocessable()->assertJsonPath('error.code', 'error.invalid');
    asApp()->postJson('/api/v1/tokens', ['name' => 'x', 'abilities' => ['*']])->assertUnprocessable();
    asApp()->postJson('/api/v1/tokens', ['name' => 'x', 'abilities' => []])->assertUnprocessable();
    $made = asApp()->postJson('/api/v1/tokens', ['name' => 'x', 'abilities' => ['tasks:read'], 'expires_in_days' => 7])->assertCreated();
    expect(substr($made->json('token.expires_at'), 0, 10))->toBe(now()->addDays(7)->toDateString());
});

it('refuses an expired token', function () {
    bearer(['tasks:read'], now()->subMinute())->getJson('/api/v1/tasks?view=inbox')->assertUnauthorized();
});

it('revokes every token on password change, password reset and sign out everywhere', function () {
    $stateful = fn () => asApp()->withHeader('Referer', 'http://localhost:3000/');

    $this->user->createToken('a', ['tasks:read']);
    $stateful()->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1', 'password' => 'new password 1', 'password_confirmation' => 'new password 1',
    ])->assertOk();
    expect($this->user->tokens()->count())->toBe(0);

    $this->user->createToken('b', ['tasks:read']);
    $stateful()->postJson('/api/v1/auth/logout-everywhere')->assertNoContent();
    expect($this->user->tokens()->count())->toBe(0);

    $this->user->createToken('c', ['tasks:read']);
    newRequest();
    $this->withoutToken()->withHeader('Referer', 'http://localhost:3000/')->postJson('/api/v1/auth/reset-password', [
        'token' => Password::createToken($this->user->fresh()), 'email' => 'example@gmail.com', 'password' => 'river stone 42',
    ])->assertNoContent();
    expect($this->user->tokens()->count())->toBe(0);
});

it('gives every signed-in route a token rule, so a new route never takes tokens by accident', function () {
    $loose = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => in_array('auth:sanctum', $route->gatherMiddleware(), true))
        ->reject(fn ($route) => collect($route->gatherMiddleware())->contains(fn ($m) => $m === 'session-only' || str_starts_with($m, 'abilities:')))
        ->map(fn ($route) => $route->methods()[0].' '.$route->uri())
        ->values()->all();

    // GET /me is the one route any token may read
    expect($loose)->toBe(['GET api/v1/me']);
});

it('caps an account at 10 unexpired tokens', function () {
    foreach (range(1, 9) as $i) {
        $this->user->createToken("t{$i}", ['tasks:read'], now()->addDay());
    }
    $this->user->createToken('expired', ['tasks:read'], now()->subDay());

    asApp()->postJson('/api/v1/tokens', ['name' => 'tenth', 'abilities' => ['tasks:read']])->assertCreated();
    asApp()->postJson('/api/v1/tokens', ['name' => 'eleventh', 'abilities' => ['tasks:read']])
        ->assertUnprocessable()->assertJsonPath('error.code', 'auth.token_limit');
});

it("uses a token's X-Timezone for the request but never stores it, which would move reminders", function () {
    $this->user->forceFill(['timezone' => 'Asia/Ho_Chi_Minh', 'timezone_auto' => true])->save();

    bearer(['tasks:read'])->withHeader('X-Timezone', 'America/New_York')->getJson('/api/v1/tasks?view=inbox')->assertOk();

    expect($this->user->fresh()->timezone)->toBe('Asia/Ho_Chi_Minh');
});
