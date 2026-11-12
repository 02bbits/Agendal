<?php

declare(strict_types=1);

namespace App\Support;

use App\Exceptions\ApiError;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

final class CurrentPasswordGuard
{
    public static function assertCorrect(User $user, string $password): void
    {
        $key = 'current-password:'.$user->id;

        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);

            throw new ApiError(
                'error.rate_limited',
                "Too many tries. Try again in {$seconds} s.",
                429,
                [],
                ['retry_after' => $seconds],
            );
        }

        if (! Hash::check($password, (string) $user->password)) {
            RateLimiter::hit($key, 900);

            throw new ApiError('auth.current_password_wrong', "That's not your current password.", 422, [
                'current_password' => ["That's not your current password."],
            ]);
        }

        RateLimiter::clear($key);
    }
}
