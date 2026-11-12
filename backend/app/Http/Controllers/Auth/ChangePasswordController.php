<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\PasswordChanged;
use App\Support\Audit;
use App\Support\CurrentPasswordGuard;
use App\Support\NewPassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ChangePasswordController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->hasSession(), 403);

        $validator = Validator::make($request->all(), [
            'current_password' => ['required', 'string', 'max:128'],
            'password' => ['required', 'string', 'max:128'],
            'password_confirmation' => ['required', 'string', 'max:128'],
        ]);
        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        /** @var User $user */
        $user = $request->user();

        $currentPassword = (string) $request->input('current_password');
        $password = (string) $request->input('password');
        $passwordConfirmation = (string) $request->input('password_confirmation');

        CurrentPasswordGuard::assertCorrect($user, $currentPassword);

        $passwordValidator = Validator::make(
            ['password' => $password],
            ['password' => NewPassword::rules((string) $user->email)],
            NewPassword::messages()
        );
        if ($passwordValidator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $passwordValidator->errors()->toArray());
        }

        if ($currentPassword === $password || Hash::check($password, (string) $user->password)) {
            throw new ApiError('auth.password_same_as_current', 'Your new password must be different from the current one.', 422, [
                'password' => ['Your new password must be different from the current one.'],
            ]);
        }

        if ($passwordConfirmation !== $password) {
            throw new ApiError('auth.password_mismatch', "New passwords don't match.", 422, [
                'password_confirmation' => ["New passwords don't match."],
            ]);
        }

        NewPassword::assertNotBreached($password);

        $user->password = $password;
        $user->setRememberToken(Str::random(60));
        $user->save();

        $currentSessionId = $request->session()->getId();
        DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', '!=', $currentSessionId)
            ->delete();

        $request->session()->regenerate();
        $user->notify(new PasswordChanged);
        Audit::log($request, 'password_changed', $user->id);

        return response()->json(['user' => $user]);
    }
}
