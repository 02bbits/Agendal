<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\Auth\PendingSignup;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;

// Sign-up waits in the cache until the code is verified (Refs #149)
class PendingSignupController extends Controller
{
    public function show(Request $request, PendingSignup $pendingSignup): JsonResponse
    {
        abort_unless($request->hasSession(), 403);

        $current = $pendingSignup->current($request);
        if ($current === null) {
            throw new ApiError('auth.signup_expired', 'This sign-up has expired. Create your account again.', 404);
        }

        return response()->json(['email' => $current['email']]);
    }

    public function verify(Request $request, PendingSignup $pendingSignup): JsonResponse
    {
        abort_unless($request->hasSession(), 403);

        $ip = (string) $request->ip();
        $perIp = "login-ip:{$ip}";
        if (RateLimiter::tooManyAttempts($perIp, 30)) {
            $seconds = RateLimiter::availableIn($perIp);
            throw new ApiError('auth.locked', "Too many attempts. Try again in {$seconds} s.", 429, [], ['retry_after' => $seconds]);
        }
        RateLimiter::hit($perIp, 600);

        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        $user = $pendingSignup->verify($request, (string) $request->input('code'));

        Auth::guard('web')->login($user, remember: true);
        $request->session()->regenerate();
        Audit::log($request, 'sign_up', $user->id);
        Audit::log($request, 'email_verified', $user->id);

        return response()->json(['user' => $user]);
    }

    public function resend(Request $request, PendingSignup $pendingSignup): Response
    {
        abort_unless($request->hasSession(), 403);

        $pendingSignup->resend($request);

        return response()->noContent();
    }

    public function cancel(Request $request, PendingSignup $pendingSignup): Response
    {
        abort_unless($request->hasSession(), 403);

        $pendingSignup->cancel($request);

        return response()->noContent();
    }
}
