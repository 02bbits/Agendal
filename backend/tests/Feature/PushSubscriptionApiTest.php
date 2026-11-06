<?php

declare(strict_types=1);

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;

uses(RefreshDatabase::class);

it('returns public VAPID key or null when not configured', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    Config::set('services.webpush.public_key', null);
    $this->getJson('/api/v1/push-subscriptions/key')
        ->assertOk()
        ->assertExactJson(['key' => null]);

    Config::set('services.webpush.public_key', 'test-public-key');
    $this->getJson('/api/v1/push-subscriptions/key')
        ->assertOk()
        ->assertExactJson(['key' => 'test-public-key']);
});

it('SEC-16: requires authentication for push subscription endpoints', function () {
    $this->getJson('/api/v1/push-subscriptions/key')->assertStatus(401);
    $this->postJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/1',
        'keys' => ['p256dh' => 'k1', 'auth' => 'a1'],
    ])->assertStatus(401);
    $this->deleteJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/1',
    ])->assertStatus(401);
});

it('SEC-16: validates endpoint must be an https url and keys must be present', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    // http endpoint rejected (422)
    $this->postJson('/api/v1/push-subscriptions', [
        'endpoint' => 'http://insecure.example.com/sub/1',
        'keys' => ['p256dh' => 'key', 'auth' => 'auth'],
    ])->assertStatus(422)
        ->assertJsonStructure(['error' => ['fields' => ['endpoint']]]);

    // missing keys rejected (422)
    $this->postJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/1',
    ])->assertStatus(422)
        ->assertJsonStructure(['error' => ['fields' => ['keys']]]);

    // missing p256dh or auth inside keys
    $this->postJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/1',
        'keys' => ['p256dh' => 'key'],
    ])->assertStatus(422)
        ->assertJsonStructure(['error' => ['fields' => ['keys.auth']]]);
});

it('SEC-16: user_id in the body is ignored and taken from session', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $this->actingAs($user);

    $this->postJson('/api/v1/push-subscriptions', [
        'user_id' => $otherUser->id,
        'endpoint' => 'https://push.example.com/sub/user-test',
        'keys' => ['p256dh' => 'key123', 'auth' => 'auth123'],
    ])->assertCreated()->assertExactJson([]);

    $sub = PushSubscription::withoutGlobalScope('owner')->where('endpoint', 'https://push.example.com/sub/user-test')->firstOrFail();
    expect($sub->user_id)->toBe($user->id);
});

it('SEC-16: a second user posting the same endpoint takes it over', function () {
    $userA = User::factory()->create();
    $userB = User::factory()->create();

    $this->actingAs($userA);
    $this->postJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/shared-device',
        'keys' => ['p256dh' => 'k-a', 'auth' => 'a-a'],
    ])->assertCreated();

    expect(PushSubscription::withoutGlobalScope('owner')->where('endpoint', 'https://push.example.com/sub/shared-device')->value('user_id'))
        ->toBe($userA->id);

    $this->actingAs($userB);
    $this->postJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/shared-device',
        'keys' => ['p256dh' => 'k-b', 'auth' => 'a-b'],
    ])->assertCreated();

    $sub = PushSubscription::withoutGlobalScope('owner')->where('endpoint', 'https://push.example.com/sub/shared-device')->firstOrFail();
    expect($sub->user_id)->toBe($userB->id)
        ->and($sub->keys['p256dh'])->toBe('k-b');
});

it('SEC-16: delete does not remove another user row and returns 204', function () {
    $userA = User::factory()->create();
    $userB = User::factory()->create();

    $subA = PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $userA->id,
        'endpoint' => 'https://push.example.com/sub/user-a',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    $this->actingAs($userB);
    // userB attempts to delete userA's endpoint
    $this->deleteJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/user-a',
    ])->assertNoContent();

    // userA's row still exists
    expect(PushSubscription::withoutGlobalScope('owner')->where('id', $subA->id)->exists())->toBeTrue();

    // userA can delete their own endpoint
    $this->actingAs($userA);
    $this->deleteJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/user-a',
    ])->assertNoContent();

    expect(PushSubscription::withoutGlobalScope('owner')->where('id', $subA->id)->exists())->toBeFalse();

    // deleting nonexistent endpoint returns 204
    $this->deleteJson('/api/v1/push-subscriptions', [
        'endpoint' => 'https://push.example.com/sub/nonexistent',
    ])->assertNoContent();
});
