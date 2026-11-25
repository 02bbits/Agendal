<?php

declare(strict_types=1);

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// #186, TK-6, TK §2.5, SC-18 / SEC-16: devices that get reminders
uses(RefreshDatabase::class);

const FCM = 'https://fcm.googleapis.com/fcm/send/dev-1';

function subscriptionBody(string $endpoint = FCM, array $keys = []): array
{
    return ['endpoint' => $endpoint, 'keys' => [
        'p256dh' => str_repeat('B', 87),
        'auth' => str_repeat('a', 22),
        ...$keys,
    ]];
}

describe('signed in', function () {
    beforeEach(function () {
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    });

    it('gives no public key while reminders are not set up', function () {
        config(['push.vapid.public_key' => null, 'push.vapid.private_key_file' => null]);
        $this->getJson('/api/v1/push-subscriptions/key')->assertOk()->assertExactJson(['public_key' => null]);
    });

    it('gives the public key once both keys are set, never the private one', function () {
        $file = tempnam(sys_get_temp_dir(), 'vapid');
        file_put_contents($file, 'private-key');
        config(['push.vapid.public_key' => 'PUBLIC', 'push.vapid.private_key_file' => $file]);

        $this->getJson('/api/v1/push-subscriptions/key')->assertOk()->assertExactJson(['public_key' => 'PUBLIC']);
        @unlink($file);
    });

    it('saves this device, and a second save updates its keys instead of adding a row', function () {
        $this->postJson('/api/v1/push-subscriptions', subscriptionBody())->assertStatus(201);
        $this->postJson('/api/v1/push-subscriptions', subscriptionBody(keys: ['auth' => str_repeat('z', 22)]))->assertStatus(201);

        $rows = PushSubscription::all();
        expect($rows)->toHaveCount(1)
            ->and($rows[0]->user_id)->toBe($this->user->id)
            ->and($rows[0]->keys['auth'])->toBe(str_repeat('z', 22));
    });

    it('moves an endpoint another account had to this user (same browser, new sign-in)', function () {
        $other = User::factory()->create();
        PushSubscription::query()->create(['user_id' => $other->id, 'endpoint' => FCM, 'keys' => ['p256dh' => 'x', 'auth' => 'y']]);

        $this->postJson('/api/v1/push-subscriptions', subscriptionBody())->assertStatus(201);

        expect(PushSubscription::query()->where('endpoint', FCM)->value('user_id'))->toBe($this->user->id)
            ->and(PushSubscription::query()->where('user_id', $other->id)->count())->toBe(0);
    });

    it('accepts each known push service', function (string $endpoint) {
        $this->postJson('/api/v1/push-subscriptions', subscriptionBody($endpoint))->assertStatus(201);
    })->with([
        'Chrome' => 'https://fcm.googleapis.com/fcm/send/abc',
        'Firefox' => 'https://updates.push.services.mozilla.com/wpush/v2/abc',
        'Safari' => 'https://web.push.apple.com/QM1yU',
        'Edge' => 'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]);

    it('refuses an endpoint the server must never post to (SSRF)', function (string $endpoint) {
        $this->postJson('/api/v1/push-subscriptions', subscriptionBody($endpoint))
            ->assertStatus(422)->assertJsonPath('error.fields.endpoint.0', fn ($m) => is_string($m));
        expect(PushSubscription::count())->toBe(0);
    })->with([
        'plain http' => 'http://fcm.googleapis.com/fcm/send/abc',
        'unknown host' => 'https://evil.example/push',
        'look-alike host' => 'https://fcm.googleapis.com.evil.example/push',
        'internal address' => 'https://169.254.169.254/latest/meta-data',
        'localhost' => 'https://localhost/push',
        'custom port' => 'https://fcm.googleapis.com:8443/fcm/send/abc',
        'credentials' => 'https://user:pass@fcm.googleapis.com/fcm/send/abc',
        'not a url' => 'javascript:alert(1)',
    ]);

    it('refuses keys that are not a browser\'s', function (array $keys) {
        $this->postJson('/api/v1/push-subscriptions', subscriptionBody(keys: $keys))->assertStatus(422);
    })->with([
        'short public key' => [['p256dh' => 'abc']],
        'bad characters' => [['auth' => str_repeat('a', 20).'+/']],
        'missing auth' => [['auth' => '']],
    ]);

    it('removes only its own subscription, and always answers 204', function () {
        $other = User::factory()->create();
        PushSubscription::query()->create(['user_id' => $other->id, 'endpoint' => 'https://fcm.googleapis.com/fcm/send/other', 'keys' => ['p256dh' => 'x', 'auth' => 'y']]);
        $this->postJson('/api/v1/push-subscriptions', subscriptionBody())->assertStatus(201);

        $this->deleteJson('/api/v1/push-subscriptions', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/other'])->assertNoContent();
        $this->deleteJson('/api/v1/push-subscriptions', ['endpoint' => FCM])->assertNoContent();
        $this->deleteJson('/api/v1/push-subscriptions', [])->assertNoContent();

        expect(PushSubscription::query()->pluck('user_id')->all())->toBe([$other->id]);
    });
});

it('SEC-16: needs a signed-in user', function (string $method, string $url) {
    $this->json($method, $url, subscriptionBody())->assertStatus(401);
})->with([
    ['GET', '/api/v1/push-subscriptions/key'],
    ['POST', '/api/v1/push-subscriptions'],
    ['DELETE', '/api/v1/push-subscriptions'],
]);

describe('sign-out', function () {
    beforeEach(function () {
        config(['session.driver' => 'database']);
        newRequest();
        $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
        $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'password 1']);
    });

    /** Signs a fresh browser in and returns its cookies. */
    function pushSignedInDevice(): array
    {
        newRequest();
        (fn () => $this->defaultCookies = $this->unencryptedCookies = [])->call(test()->target);
        $cookies = carryCookies(test()->get('/sanctum/csrf-cookie'));
        newRequest();
        $login = test()->withCookies($cookies)->postJson('/api/v1/auth/login', ['email' => 'example@gmail.com', 'password' => 'password 1'])->assertOk();

        return carryCookies($login) + $cookies;
    }

    function pushAs(array $cookies): TestCase
    {
        newRequest();
        (fn () => $this->defaultCookies = $this->unencryptedCookies = [])->call(test()->target);

        return test()->withCookies($cookies);
    }

    it('removes this device\'s subscription, and keeps the account\'s other devices', function () {
        $other = 'https://updates.push.services.mozilla.com/wpush/v2/other';
        PushSubscription::query()->create(['user_id' => $this->user->id, 'endpoint' => $other, 'keys' => ['p256dh' => 'x', 'auth' => 'y']]);
        PushSubscription::query()->create(['user_id' => $this->user->id, 'endpoint' => FCM, 'keys' => ['p256dh' => 'x', 'auth' => 'y']]);

        pushAs(pushSignedInDevice())->postJson('/api/v1/auth/logout', ['push_endpoint' => FCM])->assertNoContent();

        expect(PushSubscription::query()->pluck('endpoint')->all())->toBe([$other]);
    });

    it('on all devices removes every subscription of the account', function () {
        $someoneElse = User::factory()->create();
        PushSubscription::query()->create(['user_id' => $this->user->id, 'endpoint' => FCM, 'keys' => ['p256dh' => 'x', 'auth' => 'y']]);
        PushSubscription::query()->create(['user_id' => $someoneElse->id, 'endpoint' => 'https://web.push.apple.com/x', 'keys' => ['p256dh' => 'x', 'auth' => 'y']]);

        pushAs(pushSignedInDevice())->postJson('/api/v1/auth/logout-everywhere')->assertNoContent();

        expect(PushSubscription::query()->pluck('user_id')->all())->toBe([$someoneElse->id]);
    });
});
