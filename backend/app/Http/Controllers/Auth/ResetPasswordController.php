<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\PasswordChanged;
use App\Support\Audit;
use App\Support\EmailInput;
use App\Support\NewPassword;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

// AA-4: set a new password from the emailed link. The token is single use and lasts 60 min (SC-05).
class ResetPasswordController extends Controller
{
    public function __invoke(Request $request): Response
    {
        abort_unless($request->hasSession(), 403);
        $input = [
            'token' => $request->input('token'),
            'email' => EmailInput::from($request),
            'password' => $request->input('password'),
        ];

        $request->validate(['token' => ['required', 'string', 'max:255'], 'email' => ['required', 'string', 'max:254']]);

        // The token first: without a valid link, nothing else runs (no password rules, no call to the
        // breach service)
        /** @var PasswordBroker $broker getUser() and tokenExists() live on the concrete broker */
        $broker = Password::broker();
        $owner = $broker->getUser(['email' => $input['email']]);
        if ($owner === null || ! $broker->tokenExists($owner, (string) $input['token'])) {
            throw $this->expired();
        }

        $validator = Validator::make($input, ['password' => NewPassword::rules((string) $input['email'])], NewPassword::messages());
        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }
        NewPassword::assertNotBreached($input['password']);

        $status = $broker->reset($input, function (User $user, string $password) {
            $user->password = $password;
            // Ends Remember me on every other device
            $user->setRememberToken(Str::random(60));
            $user->save();
        });
        if ($status !== Password::PASSWORD_RESET) {
            throw $this->expired();
        }

        /** @var User $user */
        $user = User::query()->where('email', $input['email'])->firstOrFail();
        // Every session ends and nobody is signed in: the link proves the inbox, and sign-in still
        // asks for the password and the two-step code (AA §2.3, SC-05)
        DB::table('sessions')->where('user_id', $user->id)->delete();
        if (Auth::guard('web')->id() === $user->id) {
            // This device was signed in as the account: saving its session again would bring it back
            $request->attributes->set('signed_out', true);
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
        $user->notify(new PasswordChanged);
        Audit::log($request, 'reset_used', $user->id);

        return response()->noContent();
    }

    private function expired(): ApiError
    {
        return new ApiError('auth.reset_expired', 'This link has expired or was already used. Request a new one.');
    }
}
