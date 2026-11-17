<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\EmailVerification;
use App\Services\Clock\ClockInterface;
use DateTimeInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TwoFactorResendController extends Controller
{
    public function __construct(
        private readonly EmailVerification $emailVerification,
        private readonly ClockInterface $clock,
    ) {}

    public function __invoke(Request $request): Response
    {
        abort_unless($request->hasSession(), 403);

        $userId = $request->session()->get('two_factor.user_id');
        $expiresAt = $request->session()->get('two_factor.expires_at');

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

        /** @var User $user */
        $user = User::findOrFail($userId);

        $this->emailVerification->resend($user, 'sign_in');

        return response()->noContent();
    }
}
