<?php

declare(strict_types=1);

use App\Models\Task;
use App\Models\User;
use Database\Seeders\E2eSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('runs the e2e seeder twice idempotently and cleans up previous user data', function () {
    $this->seed(E2eSeeder::class);

    expect(User::where('email', 'like', 'e2e-%@example.test')->count())->toBe(80);

    $user1 = User::where('email', 'e2e-01@example.test')->firstOrFail();
    expect($user1->email_verified_at)->not->toBeNull()
        ->and($user1->display_name)->toBe('E2E User 01')
        ->and($user1->install_prompt_shown)->toBeTrue()
        ->and($user1->two_factor_enabled)->toBeFalse()
        ->and($user1->timezone)->toBe('Asia/Ho_Chi_Minh');

    // Create a task for e2e-01 before the second run
    $task = Task::forceCreate([
        'user_id' => $user1->id,
        'title' => 'Test Task to be wiped',
    ]);
    expect(Task::withoutGlobalScope('owner')->where('id', $task->id)->exists())->toBeTrue();

    // Run the seeder a second time
    $this->seed(E2eSeeder::class);

    // Asserts 80 users
    expect(User::where('email', 'like', 'e2e-%@example.test')->count())->toBe(80);

    // Old task is gone
    expect(Task::withoutGlobalScope('owner')->where('id', $task->id)->exists())->toBeFalse();

    // Fresh user is verified and setup done
    $freshUser1 = User::where('email', 'e2e-01@example.test')->firstOrFail();
    expect($freshUser1->email_verified_at)->not->toBeNull()
        ->and($freshUser1->display_name)->toBe('E2E User 01')
        ->and($freshUser1->install_prompt_shown)->toBeTrue();
});
