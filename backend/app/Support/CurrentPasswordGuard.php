<?php

declare(strict_types=1);

namespace App\Support;

use App\Exceptions\ApiError;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

// The current-password check behind Change password and turning two-step off (AA §2.7). Two tiers
// of wrong tries, like sign-in (ADR-007): a typo costs a minute, a long run of them costs 15.
final class CurrentPasswordGuard
{
    // [key prefix, wrong tries allowed, window in seconds, lock in seconds]
    private const SHORT = ['current-password', 5, 900, 60];

    private const LONG = ['current-password-hour', 20, 3600, 900];

    public static function assertCorrect(User $user, string $password): void
    {
        $short = self::SHORT[0].':'.$user->id;
        $long = self::LONG[0].':'.$user->id;

        $locked = max(self::lockedFor($short), self::lockedFor($long));
        if ($locked > 0) {
            throw new ApiError(
                'auth.current_password_locked',
                "Too many wrong passwords. Try again in {$locked} s.",
                429,
                [],
                ['retry_after' => $locked],
            );
        }

        if (! Hash::check($password, (string) $user->password)) {
            // The try that starts a lock still answers "wrong", as sign-in does; the next one is 429
            self::fail($short, self::SHORT);
            self::fail($long, self::LONG);

            throw new ApiError('auth.current_password_wrong', "That's not your current password.", 422, [
                'current_password' => ["That's not your current password."],
            ]);
        }

        // A right password ends the short run. The hour's count stays, so a guesser can't reset it
        RateLimiter::clear($short);
    }

    private static function lockedFor(string $key): int
    {
        return RateLimiter::tooManyAttempts("{$key}:lock", 1) ? RateLimiter::availableIn("{$key}:lock") : 0;
    }

    /** @param  array{string, int, int, int}  $tier */
    private static function fail(string $key, array $tier): void
    {
        [, $tries, $window, $lock] = $tier;
        RateLimiter::hit($key, $window);
        if (RateLimiter::attempts($key) >= $tries) {
            RateLimiter::clear($key);
            RateLimiter::hit("{$key}:lock", $lock);
        }
    }
}
