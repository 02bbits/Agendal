<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Services\Auth\PendingSignup;
use App\Support\Audit;
use App\Support\EmailInput;
use App\Support\NewPassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

// AA-1: start the sign-up; user is created once the email code is verified (Refs #149)
class RegisterController extends Controller
{
    public function __invoke(Request $request, PendingSignup $pendingSignup): JsonResponse
    {
        $input = [
            'email' => EmailInput::from($request), // AA-E1
            'password' => $request->input('password'),
            'timezone' => $request->input('timezone', $request->attributes->get('timezone')),
        ];

        $email = is_string($input['email']) ? $input['email'] : '';
        $validator = Validator::make($input, [
            'email' => ['required', 'email', 'max:254'],
            'password' => NewPassword::signUpRules($email),
            'timezone' => ['required', 'timezone:all_with_bc'],
        ], NewPassword::messages());

        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        NewPassword::assertNotBreached((string) $input['password']);

        $pendingSignup->start($email, (string) $input['password'], (string) $input['timezone'], $request);
        Audit::log($request, 'sign_up_started', null);

        return response()->json(['pending' => true, 'email' => $email], 202);
    }
}
