<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\EmailVerification;
use App\Services\Clock\ClockInterface;
use App\Support\Audit;
use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;

class TwoFactorChallengeController extends Controller
{
    public function __construct(
        private readonly EmailVerification $emailVerification,
        private readonly ClockInterface $clock,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->hasSession(), 403);

        $ip = (string) $request->ip();
        $perIp = "login-ip:{$ip}";
        if (RateLimiter::tooManyAttempts($perIp, 30)) {
            $seconds = RateLimiter::availableIn($perIp);
            throw new ApiError('auth.locked', "Too many attempts. Try again in {$seconds} s.", 429, [], ['retry_after' => $seconds]);
        }
        RateLimiter::hit($perIp, 600);

        $userId = $request->session()->get('two_factor.user_id');
        $expiresAt = $request->session()->get('two_factor.expires_at');
        $remember = (bool) $request->session()->get('two_factor.remember', false);

        $now = $this->clock->now();
        $isExpired = false;
        if (! $userId || ! $expiresAt) {
            $isExpired = true;
        } elseif (is_numeric($expiresAt)) {
            $isExpired = $now->getTimestamp() >= (int) $expiresAt;
        } elseif ($expiresAt instanceof DateTimeInterface) {
            $isExpired = $now >= $expiresAt;
        }

        if ($isExpired) {
            $request->session()->forget(['two_factor.user_id', 'two_factor.remember', 'two_factor.expires_at']);

            throw new ApiError('auth.two_factor_expired', 'This sign-in has expired. Sign in again.', 422);
        }

        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        /** @var User $user */
        $user = User::findOrFail($userId);

        $this->emailVerification->verify($user, (string) $request->input('code'), $request, 'sign_in');

        Auth::guard('web')->login($user, $remember);
        $request->session()->regenerate();
        $request->session()->forget(['two_factor.user_id', 'two_factor.remember', 'two_factor.expires_at']);
        Audit::log($request, 'sign_in_two_factor', $user->id);

        return response()->json(['user' => $user]);
    }
}
