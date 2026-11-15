<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Exceptions\ApiError;
use App\Models\User;
use App\Notifications\SignUpAttempted;
use App\Notifications\VerifyEmailCode;
use App\Services\Clock\ClockInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

final class PendingSignup
{
    public const TTL = 1800;          // the waiting sign-up lasts 30 minutes

    public const CODE_TTL = 600;      // a code works 10 minutes

    public const TRIES = 5;           // the 5th wrong try ends the code

    public const RESEND_AFTER = 60;   // a new code 60 s after the last

    public const SENDS = 10;          // 10 codes per 30 minutes per email...

    public const SENDS_WINDOW = 1800;

    public const SENDS_WAIT = 1800;   // ...then wait 30 minutes

    public const SESSION_KEY = 'pending_signup.email';

    public function __construct(
        private readonly ClockInterface $clock,
    ) {}

    public function secondsBeforeSend(string $email): int
    {
        $key = 'signup-send:'.hash('sha256', $email);

        return RateLimiter::tooManyAttempts($key.':wait', 1)
            ? RateLimiter::availableIn($key.':wait')
            : 0;
    }

    public function start(string $email, string $password, string $timezone, Request $request): void
    {
        $sendWait = $this->secondsBeforeSend($email);
        if ($sendWait > 0) {
            throw new ApiError('error.rate_limited', "Too many requests. Try again in {$sendWait} s.", 429, [], ['retry_after' => $sendWait]);
        }

        $now = $this->clock->now()->getTimestamp();
        $user = User::query()->where('email', $email)->first();

        if ($user !== null) {
            $entry = [
                'email' => $email,
                'password' => '',
                'timezone' => $timezone,
                'decoy' => true,
                'code_hash' => hash_hmac('sha256', Str::random(40), (string) config('app.key')),
                'code_expires_at' => $now + self::CODE_TTL,
                'attempts' => 0,
                'sent_at' => $now,
                'started_at' => $now,
            ];
            $this->saveEntry($entry);
            $this->recordSend($email);
            $request->session()->put(self::SESSION_KEY, $email);

            $noticeKey = 'signup-notice:'.hash('sha256', $email);
            if (! RateLimiter::tooManyAttempts($noticeKey, 1)) {
                RateLimiter::hit($noticeKey, 1800);
                $ip = $request->ip();
                try {
                    $tz = filled($user->timezone) ? new \DateTimeZone($user->timezone) : new \DateTimeZone('UTC');
                    $time = now()->setTimezone($tz)->format('M j, Y, g:i A T');
                } catch (\Throwable) {
                    $time = now()->utc()->format('M j, Y, g:i A \U\T\C');
                }
                defer(fn () => $user->notify(new SignUpAttempted(ip: $ip, time: $time)));
            }
        } else {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $entry = [
                'email' => $email,
                'password' => Hash::make($password),
                'timezone' => $timezone,
                'decoy' => false,
                'code_hash' => hash_hmac('sha256', $code, (string) config('app.key')),
                'code_expires_at' => $now + self::CODE_TTL,
                'attempts' => 0,
                'sent_at' => $now,
                'started_at' => $now,
            ];
            $this->saveEntry($entry);
            $this->recordSend($email);
            $request->session()->put(self::SESSION_KEY, $email);

            defer(fn () => Notification::route('mail', $email)->notify(new VerifyEmailCode($code)));
        }
    }

    /**
     * @return array{
     *     email: string,
     *     password: string,
     *     timezone: string,
     *     decoy: bool,
     *     code_hash: string,
     *     code_expires_at: int,
     *     attempts: int,
     *     sent_at: int,
     *     started_at: int
     * }|null
     */
    public function current(Request $request): ?array
    {
        $email = $request->session()->get(self::SESSION_KEY);
        if (! is_string($email) || $email === '') {
            return null;
        }

        $key = 'pending-signup:'.hash('sha256', $email);
        $entry = Cache::get($key);
        if (! is_array($entry)) {
            $request->session()->forget(self::SESSION_KEY);

            return null;
        }

        /** @var array{
         *     email: string,
         *     password: string,
         *     timezone: string,
         *     decoy: bool,
         *     code_hash: string,
         *     code_expires_at: int,
         *     attempts: int,
         *     sent_at: int,
         *     started_at: int
         * } $entry */
        return $entry;
    }

    public function verify(Request $request, string $code): User
    {
        $entry = $this->current($request);
        if ($entry === null) {
            throw new ApiError('auth.signup_expired', 'This sign-up has expired. Create your account again.', 422);
        }

        $now = $this->clock->now()->getTimestamp();
        if ($now >= $entry['code_expires_at']) {
            throw new ApiError('auth.verify_expired', 'This code has expired. Send a new one.', 422, [
                'code' => ['This code has expired. Send a new one.'],
            ]);
        }

        if ($entry['attempts'] >= self::TRIES) {
            throw new ApiError('auth.verify_too_many', 'Too many tries. Send a new code.', 422, [
                'code' => ['Too many tries. Send a new code.'],
            ]);
        }

        if ($entry['decoy'] || ! hash_equals($entry['code_hash'], hash_hmac('sha256', $code, (string) config('app.key')))) {
            $entry['attempts']++;
            $this->saveEntry($entry);

            if ($entry['attempts'] >= self::TRIES) {
                throw new ApiError('auth.verify_too_many', 'Too many tries. Send a new code.', 422, [
                    'code' => ['Too many tries. Send a new code.'],
                ]);
            }

            throw new ApiError('auth.verify_wrong', "That code isn't right. Try again.", 422, [
                'code' => ["That code isn't right. Try again."],
            ]);
        }

        return DB::transaction(function () use ($entry, $request) {
            if (User::query()->where('email', $entry['email'])->exists()) {
                $this->forgetEntry($entry['email'], $request);

                throw new ApiError('auth.signup_expired', 'This sign-up has expired. Create your account again.', 422);
            }

            $user = new User;
            $user->forceFill([
                'email' => $entry['email'],
                'password' => $entry['password'],
                'display_name' => Str::limit(Str::before($entry['email'], '@'), 30, ''),
                'timezone' => $entry['timezone'],
                'email_verified_at' => $this->clock->now(),
            ]);
            $user->save();

            $this->forgetEntry($entry['email'], $request);

            return $user;
        });
    }

    public function resend(Request $request): void
    {
        $entry = $this->current($request);
        if ($entry === null) {
            throw new ApiError('auth.signup_expired', 'This sign-up has expired. Create your account again.', 422);
        }

        $now = $this->clock->now()->getTimestamp();
        $wait = self::RESEND_AFTER - ($now - $entry['sent_at']);
        if ($wait > 0) {
            throw new ApiError('error.rate_limited', "Too many requests. Try again in {$wait} s.", 429, [], ['retry_after' => $wait]);
        }

        $sendWait = $this->secondsBeforeSend($entry['email']);
        if ($sendWait > 0) {
            throw new ApiError('error.rate_limited', "Too many requests. Try again in {$sendWait} s.", 429, [], ['retry_after' => $sendWait]);
        }

        if ($entry['decoy']) {
            $this->recordSend($entry['email']);
            $entry['sent_at'] = $now;
            $this->saveEntry($entry);

            return;
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $entry['attempts'] = 0;
        $entry['code_hash'] = hash_hmac('sha256', $code, (string) config('app.key'));
        $entry['code_expires_at'] = $now + self::CODE_TTL;
        $entry['sent_at'] = $now;

        $this->recordSend($entry['email']);
        $this->saveEntry($entry);

        defer(fn () => Notification::route('mail', $entry['email'])->notify(new VerifyEmailCode($code)));
    }

    public function cancel(Request $request): void
    {
        $request->session()->forget(self::SESSION_KEY);
    }

    /**
     * @param array{
     *     email: string,
     *     password: string,
     *     timezone: string,
     *     decoy: bool,
     *     code_hash: string,
     *     code_expires_at: int,
     *     attempts: int,
     *     sent_at: int,
     *     started_at: int
     * } $entry
     */
    private function saveEntry(array $entry): void
    {
        $now = $this->clock->now()->getTimestamp();
        $ttl = max(1, $entry['started_at'] + self::TTL - $now);
        $key = 'pending-signup:'.hash('sha256', $entry['email']);
        Cache::put($key, $entry, $ttl);
    }

    private function forgetEntry(string $email, Request $request): void
    {
        $key = 'pending-signup:'.hash('sha256', $email);
        Cache::forget($key);
        $request->session()->forget(self::SESSION_KEY);
    }

    private function recordSend(string $email): void
    {
        $key = 'signup-send:'.hash('sha256', $email);
        RateLimiter::hit($key, self::SENDS_WINDOW);
        if (RateLimiter::attempts($key) >= self::SENDS) {
            RateLimiter::clear($key);
            RateLimiter::hit($key.':wait', self::SENDS_WAIT);
        }
    }
}
