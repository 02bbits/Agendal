<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\EmailVerification;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ResendVerificationController extends Controller
{
    public function __invoke(Request $request, EmailVerification $emailVerification): Response
    {
        /** @var User $user */
        $user = $request->user();
        $emailVerification->resend($user);

        return response()->noContent();
    }
}
