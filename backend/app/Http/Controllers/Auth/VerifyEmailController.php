<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\EmailVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class VerifyEmailController extends Controller
{
    public function __invoke(Request $request, EmailVerification $emailVerification): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        /** @var User $user */
        $user = $request->user();
        $emailVerification->verify($user, (string) $request->input('code'), $request);

        return response()->json(['user' => $user->fresh()]);
    }
}
