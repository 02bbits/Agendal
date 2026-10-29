<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

// AA-1: create the account and sign in on this device (AA §2.1)
class RegisterController extends Controller
{
    private const PASSWORD_RULE = 'At least 8 characters, and not your email.';

    private const BREACHED = 'This password has appeared in a data breach. Choose another one.';

    public function __invoke(Request $request, UncompromisedVerifier $breached): JsonResponse
    {
        $input = [
            'email' => Str::lower(trim((string) $request->input('email'))), // AA-E1
            'password' => $request->input('password'),
            'timezone' => $request->input('timezone', $request->attributes->get('timezone')),
        ];

        $validator = Validator::make($input, [
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:128', function (string $attribute, mixed $value, Closure $fail) use ($input) {
                if (Str::lower((string) $value) === $input['email']) {
                    $fail("Your password can't be your email."); // T-AA-108
                }
            }],
            'timezone' => ['required', 'timezone:all_with_bc'],
        ], [
            'email.unique' => 'An account with this email already exists. Sign in instead?',
            'password.min' => self::PASSWORD_RULE,
            'password.max' => self::PASSWORD_RULE,
        ]);

        if ($validator->fails()) {
            $code = isset($validator->failed()['email']['Unique']) ? 'auth.email_taken' : 'error.invalid';

            throw new ApiError($code, 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        // SC-02. Fails open when the service is down (AA-E10)
        if (! $breached->verify(['value' => $input['password'], 'threshold' => 0])) {
            throw new ApiError('auth.password_breached', self::BREACHED, 422, ['password' => [self::BREACHED]]);
        }

        $user = User::create([
            'email' => $input['email'],
            'password' => $input['password'],
            'display_name' => Str::limit(Str::before($input['email'], '@'), 60, ''),
            'timezone' => $input['timezone'],
        ]);
        Auth::guard('web')->login($user, remember: true);
        DB::table('audit_events')->insert([
            'user_id' => $user->id, 'event' => 'sign_up', 'ip' => $request->ip(), 'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['user' => $user], 201);
    }
}
