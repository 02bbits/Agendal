<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Exceptions\ApiError;
use App\Models\User;
use App\Notifications\SignInCode;
use App\Notifications\VerifyEmailCode;
use App\Services\Clock\ClockInterface;
use App\Support\Audit;
use DateTimeImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class EmailVerification
{
    public function __construct(
        private readonly ClockInterface $clock,
    ) {}

    public function send(User $user, string $purpose = 'verify'): void
    {
        if ($purpose === 'verify' && $user->email_verified_at !== null) {
            return;
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hash = hash_hmac('sha256', $code, (string) config('app.key'));
        $now = $this->clock->now();
        $expiresAt = $now->modify('+10 minutes');

        DB::table('email_verification_codes')->upsert([
            'user_id' => $user->id,
            'purpose' => $purpose,
            'code_hash' => $hash,
            'expires_at' => $expiresAt,
            'attempts' => 0,
            'sent_at' => $now,
        ], ['user_id', 'purpose'], ['code_hash', 'expires_at', 'attempts', 'sent_at']);

        $key = $purpose === 'verify' ? 'verify-email-send:'.$user->id : 'two-factor-send:'.$user->id;
        RateLimiter::hit($key, 3600);

        if ($purpose === 'verify') {
            $user->notify(new VerifyEmailCode($code));
        } elseif ($purpose === 'sign_in') {
            $user->notify(new SignInCode($code));
        }
    }

    public function verify(User $user, string $code, ?Request $request = null, string $purpose = 'verify'): void
    {
        if ($purpose === 'verify' && $user->email_verified_at !== null) {
            return;
        }

        $record = DB::table('email_verification_codes')
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->first();

        if (! $record) {
            throw new ApiError('auth.verify_expired', 'This code has expired. Send a new one.', 422, [
                'code' => ['This code has expired. Send a new one.'],
            ]);
        }

        $expiresAt = new DateTimeImmutable((string) $record->expires_at);
        if ($this->clock->now() >= $expiresAt) {
            throw new ApiError('auth.verify_expired', 'This code has expired. Send a new one.', 422, [
                'code' => ['This code has expired. Send a new one.'],
            ]);
        }

        if ($record->attempts >= 5) {
            throw new ApiError('auth.verify_too_many', 'Too many tries. Send a new code.', 422, [
                'code' => ['Too many tries. Send a new code.'],
            ]);
        }

        $expectedHash = hash_hmac('sha256', $code, (string) config('app.key'));
        if (! hash_equals($record->code_hash, $expectedHash)) {
            DB::table('email_verification_codes')
                ->where('user_id', $user->id)
                ->where('purpose', $purpose)
                ->increment('attempts');

            throw new ApiError('auth.verify_wrong', "That code isn't right. Try again.", 422, [
                'code' => ["That code isn't right. Try again."],
            ]);
        }

        $now = $this->clock->now();
        if ($purpose === 'verify') {
            $user->forceFill(['email_verified_at' => $now])->save();
        }

        DB::table('email_verification_codes')
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->delete();

        if ($purpose === 'verify') {
            Audit::log($request ?? request(), 'email_verified', $user->id);
        }
    }

    public function resend(User $user, string $purpose = 'verify'): void
    {
        if ($purpose === 'verify' && $user->email_verified_at !== null) {
            return;
        }

        $record = DB::table('email_verification_codes')
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->first();

        if ($record && $record->sent_at !== null) {
            $sentAt = new DateTimeImmutable((string) $record->sent_at);
            $elapsed = $this->clock->now()->getTimestamp() - $sentAt->getTimestamp();
            if ($elapsed < 45) {
                $seconds = 45 - $elapsed;
                throw new ApiError(
                    'error.rate_limited',
                    "Too many requests. Try again in {$seconds} s.",
                    429,
                    [],
                    ['retry_after' => $seconds],
                );
            }
        }

        $key = $purpose === 'verify' ? 'verify-email-send:'.$user->id : 'two-factor-send:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = max(1, RateLimiter::availableIn($key));
            throw new ApiError(
                'error.rate_limited',
                "Too many requests. Try again in {$seconds} s.",
                429,
                [],
                ['retry_after' => $seconds],
            );
        }

        $this->send($user, $purpose);
    }
}
