<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

// AA-4: email a reset link. The answer is the same whether or not the account exists (SC-04, T-AA-30).
class ForgotPasswordController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $request->validate(['email' => ['required', 'string', 'max:254']]);
        $email = Str::lower(trim($request->string('email'))); // AA-E1

        // Sent after the response, so a known email doesn't answer slower than an unknown one (SC-04).
        // Unknown email, or a resend within 45 s: nothing is sent, and the caller can't tell.
        defer(fn () => Password::broker()->sendResetLink(['email' => $email]));
        Audit::log($request, 'reset_requested', User::query()->where('email', $email)->value('id'));

        return response()->noContent(202);
    }
}
