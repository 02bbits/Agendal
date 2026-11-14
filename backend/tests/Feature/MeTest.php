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
        'remember_device' => true, 'install_prompt_shown' => false, 'timezone_auto' => true,
        'theme_palette' => 'default', 'page_view' => 'flat',
    ])->assertJsonMissing(['password' => $this->user->password])->assertJsonMissingPath('remember_token');
});

it('T-AP-21, T-AP-50: saves settings, and the next read on any device sees them', function () {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', [
        'theme' => 'dark', 'week_start' => 'sun', 'time_format' => '12h', 'remember_device' => false, 'install_prompt_shown' => true,
        'theme_palette' => 'lavender', 'page_view' => 'full',
    ])->assertOk()->assertJson([
        'theme' => 'dark', 'week_start' => 'sun', 'theme_palette' => 'lavender', 'page_view' => 'full',
    ]);

    $this->app['auth']->forgetGuards();
    $this->actingAs(User::find($this->user->id), 'sanctum')->getJson('/api/v1/me')->assertJson([
        'theme' => 'dark', 'week_start' => 'sun', 'time_format' => '12h', 'remember_device' => false, 'install_prompt_shown' => true,
        'theme_palette' => 'lavender', 'page_view' => 'full',
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
    'name too long' => [['display_name' => str_repeat('a', 31)]],
    'invalid timezone' => [['timezone' => 'Invalid/Zone']],
    'theme palette' => [['theme_palette' => 'neon']],
    'page view' => [['page_view' => 'wide']],
]);

it('PR #153: saves a display name of 3 to 30 characters, trimmed, emoji included', function (string $sent, string $saved) {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', ['display_name' => $sent])->assertOk();

    expect($this->user->fresh()->display_name)->toBe($saved);
})->with([
    'three' => ['Tâm', 'Tâm'],
    'thirty' => [str_repeat('n', 30), str_repeat('n', 30)],
    'trimmed' => ['  Minh Anh  ', 'Minh Anh'],
    'emoji with a joiner' => ['Dev 👩‍💻', 'Dev 👩‍💻'],
]);

it('PR #153: refuses a display name outside 3 to 30 characters or with hidden characters', function (mixed $sent, string $message) {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', ['display_name' => $sent])->assertStatus(422)
        ->assertJsonPath('error.fields.display_name.0', $message);

    expect($this->user->fresh()->display_name)->toBe($this->user->display_name);
})->with([
    'two' => ['ab', 'Use 3 to 30 characters.'],
    'two after trimming' => ['  ab  ', 'Use 3 to 30 characters.'],
    'thirty-one' => [str_repeat('n', 31), 'Use 3 to 30 characters.'],
    'a tag' => ['<b>boss</b>', "Use letters, numbers, spaces and emoji. Angle brackets and hidden characters aren't allowed."],
    'a text-direction override' => ["evil\u{202E}gpj.exe", "Use letters, numbers, spaces and emoji. Angle brackets and hidden characters aren't allowed."],
    'a zero-width space' => ["ad\u{200B}min", "Use letters, numbers, spaces and emoji. Angle brackets and hidden characters aren't allowed."],
    'a newline' => ["Minh\nAnh", "Use letters, numbers, spaces and emoji. Angle brackets and hidden characters aren't allowed."],
]);

it('PR #153: refuses an empty or non-text display name', function (mixed $sent) {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', ['display_name' => $sent])->assertStatus(422);
})->with(['empty' => [''], 'spaces' => ['   '], 'null' => [null], 'array' => [['a', 'b', 'c']]]);

it('ignores fields a user must not set', function () {
    $this->actingAs($this->user, 'sanctum')->patchJson('/api/v1/me', ['email' => 'x@example.com', 'password' => 'hacked hacked 1'])->assertOk();

    expect($this->user->fresh()->email)->toBe($this->user->email);
});

it('needs a session', function () {
    $this->getJson('/api/v1/me')->assertUnauthorized();
    $this->patchJson('/api/v1/me', ['theme' => 'dark'])->assertUnauthorized();
});
