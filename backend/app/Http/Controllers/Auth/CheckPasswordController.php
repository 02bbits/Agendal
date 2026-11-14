<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiError;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\CurrentPasswordGuard;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

class CheckPasswordController extends Controller
{
    public function __invoke(Request $request): Response
    {
        abort_unless($request->hasSession(), 403);

        $validator = Validator::make($request->all(), [
            'current_password' => ['required', 'string', 'max:128'],
        ]);
        if ($validator->fails()) {
            throw new ApiError('error.invalid', 'Check the highlighted fields.', 422, $validator->errors()->toArray());
        }

        /** @var User $user */
        $user = $request->user();

        CurrentPasswordGuard::assertCorrect($user, (string) $request->input('current_password'));

        return response()->noContent();
    }
}
