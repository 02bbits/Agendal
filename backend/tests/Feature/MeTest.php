<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

// IM-16: GET/PATCH /me (AP-3, AP-5)
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create()->fresh();
});

it('T-AP-21, T-AP-50: returns the settings with their defaults', function () {
    $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/me')->assertOk()->assertJson([
        'id' => $this->user->id, 'theme' => 'system', 'week_start' => 'mon', 'time_format' => '24h',
        'remember_device' => true, 'install_prompt_shown' => false,
    ])->assertJsonMissing(['password' => $this->user->password])->assertJsonMissingPath('remember_token');
});

it('T-AP-21, T-AP-50: saves settings, and the next read on any device sees them', function () {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', [
        'theme' => 'dark', 'week_start' => 'sun', 'time_format' => '12h', 'remember_device' => false, 'install_prompt_shown' => true,
    ])->assertOk()->assertJson(['theme' => 'dark', 'week_start' => 'sun']);

    $this->app['auth']->forgetGuards();
    $this->actingAs(User::find($this->user->id), 'sanctum')->getJson('/api/v1/me')->assertJson([
        'theme' => 'dark', 'week_start' => 'sun', 'time_format' => '12h', 'remember_device' => false, 'install_prompt_shown' => true,
    ]);
});

it('changes only the fields sent', function () {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', ['theme' => 'light'])->assertOk();

    expect($this->user->fresh())->theme->toBe('light')->week_start->toBe('mon')->display_name->toBe($this->user->display_name);
});

it('rejects values outside the allowed set with 422', function (array $body) {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', $body)->assertStatus(422);
})->with([
    'theme' => [['theme' => 'sepia']],
    'week start' => [['week_start' => 'wed']],
    'time format' => [['time_format' => '13h']],
    'remember device' => [['remember_device' => 'maybe']],
    'name too long' => [['display_name' => str_repeat('a', 61)]],
]);

it('ignores fields a user must not set', function () {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', ['email' => 'x@example.com', 'password' => 'hacked hacked 1'])->assertOk();

    expect($this->user->fresh()->email)->toBe($this->user->email);
});

it('needs a session', function () {
    $this->getJson('/api/v1/me')->assertUnauthorized();
    $this->patchJson('/api/v1/me', ['theme' => 'dark'])->assertUnauthorized();
});
