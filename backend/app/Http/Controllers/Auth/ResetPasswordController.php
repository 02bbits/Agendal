<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\PasswordChanged;
use App\Support\Audit;
use App\Support\NewPassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

// AA-4: set a new password from the emailed link. The token is single use and lasts 60 min (SC-05).
class ResetPasswordController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->hasSession(), 403);
        $input = [
            'token' => $request->input('token'),
            'email' => Str::lower(trim((string) $request->input('email'))),
            'password' => $request->input('password'),
        ];

        $request->validate(['token' => ['required', 'string'], 'email' => ['required', 'string', 'max:254']]);

        // The token first: without a valid link, nothing else runs (no password rules, no call to the
        // breach service)
        $broker = Password::broker();
        $owner = $broker->getUser(['email' => $input['email']]);
        if ($owner === null || ! $broker->tokenExists($owner, (string) $input['token'])) {
            throw $this->expired();
        }

        $validator = Validator::make($input, ['password' => NewPassword::rules($input['email'])], NewPassword::messages());
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
        // Every other session ends; this device is signed in (AA §2.3, SC-05)
        DB::table('sessions')->where('user_id', $user->id)->delete();
        Auth::guard('web')->login($user, remember: true);
        $request->session()->regenerate();
        $user->notify(new PasswordChanged);
        Audit::log($request, 'reset_used', $user->id);

        return response()->json(['user' => $user]);
    }

    private function expired(): ApiError
    {
        return new ApiError('auth.reset_expired', 'This link has expired or was already used. Request a new one.');
    }
}
