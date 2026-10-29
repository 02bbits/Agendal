<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

// AA-2 and AA-3: sign in, with the lockouts from ADR-007. Every lock looks the same to the
// caller, so an attacker can't tell which one fired, and a wrong email and a wrong password
// get the same answer in the same time (Auth::attempt pads its timing, SC-04).
class LoginController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        // Sessions exist only for requests from the app's own origin (Sanctum stateful domains, ADR-007)
        abort_unless($request->hasSession(), 403);
        $request->validate([
            'email' => ['required', 'string', 'max:254'],
            'password' => ['required', 'string', 'max:128'],
            'remember' => ['boolean'],
        ]);
        $email = Str::lower(trim($request->string('email'))); // AA-E1
        $ip = (string) $request->ip();

        // A failure counter per scope: [key, failures allowed, window in seconds, lock in seconds]
        $pair = ["login:{$email}|{$ip}", 3, 600, 60];       // AA-3, keyed so a victim's own IP still works (SC-03)
        $perEmail = ["login-email:{$email}", 20, 3600, 900];

        // 30 attempts per IP per 10 minutes, across all emails
        $perIp = "login-ip:{$ip}";
        $locked = max(
            $this->lockedFor($pair[0]),
            $this->lockedFor($perEmail[0]),
            RateLimiter::tooManyAttempts($perIp, 30) ? RateLimiter::availableIn($perIp) : 0,
        );
        if ($locked > 0) {
            throw $this->lockedError($locked);
        }
        RateLimiter::hit($perIp, 600);

        if (! Auth::guard('web')->attempt(['email' => $email, 'password' => $request->string('password')->value()], $request->boolean('remember'))) {
            $userId = User::query()->where('email', $email)->value('id');
            $this->audit($request, 'sign_in_failed', $userId);
            $lockedNow = max($this->fail($pair), $this->fail($perEmail));
            if ($lockedNow > 0) {
                $this->audit($request, 'lockout', $userId);
            }

            throw new ApiError('auth.invalid', 'Email or password is incorrect.');
        }

        $request->session()->regenerate(); // SEC-04
        RateLimiter::clear($pair[0]);
        /** @var User $user */
        $user = Auth::guard('web')->user();
        $this->audit($request, 'sign_in', $user->id);

        return response()->json(['user' => $user]);
    }

    private function lockedFor(string $key): int
    {
        return RateLimiter::tooManyAttempts("{$key}:lock", 1) ? RateLimiter::availableIn("{$key}:lock") : 0;
    }

    /**
     * Counts one failure. Returns the lock length when this failure starts a lock.
     *
     * @param  array{string, int, int, int}  $scope
     */
    private function fail(array $scope): int
    {
        [$key, $allowed, $window, $lock] = $scope;
        RateLimiter::hit($key, $window);
        if (RateLimiter::attempts($key) < $allowed) {
            return 0;
        }
        RateLimiter::clear($key);
        RateLimiter::hit("{$key}:lock", $lock);

        return $lock;
    }

    private function lockedError(int $seconds): ApiError
    {
        return new ApiError('auth.locked', "Too many attempts. Try again in {$seconds} s.", 429, [], ['retry_after' => $seconds]);
    }

    private function audit(Request $request, string $event, ?int $userId): void
    {
        DB::table('audit_events')->insert([
            'user_id' => $userId, 'event' => $event, 'ip' => $request->ip(), 'user_agent' => $request->userAgent(),
        ]);
    }
}
