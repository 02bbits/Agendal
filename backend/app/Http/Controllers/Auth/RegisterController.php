<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use App\Support\NewPassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

// AA-1: create the account and sign in on this device (AA §2.1)
class RegisterController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $input = [
            'email' => Str::lower(trim((string) $request->input('email'))), // AA-E1
            'password' => $request->input('password'),
            'timezone' => $request->input('timezone', $request->attributes->get('timezone')),
        ];

        $validator = Validator::make($input, [
            'email' => ['required', 'email', 'max:254', 'unique:users,email'],
            'password' => NewPassword::rules($input['email']),
            'timezone' => ['required', 'timezone:all_with_bc'],
        ], [
            'email.unique' => 'An account with this email already exists. Sign in instead?',
        ] + NewPassword::messages());

        if ($validator->fails()) {
            $code = isset($validator->failed()['email']['Unique']) ? 'auth.email_taken' : 'error.invalid';

            throw new ApiError($code, 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        NewPassword::assertNotBreached($input['password']);

        $user = User::create([
            'email' => $input['email'],
            'password' => $input['password'],
            'display_name' => Str::limit(Str::before($input['email'], '@'), 60, ''),
            'timezone' => $input['timezone'],
        ]);
        Auth::guard('web')->login($user, remember: true);
        Audit::log($request, 'sign_up', $user->id);

        return response()->json(['user' => $user], 201);
    }
}
