<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use App\Support\CurrentPasswordGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwoFactorController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'enabled' => ['required', 'boolean'],
            'current_password' => ['nullable', 'string'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $enabled = $request->boolean('enabled');

        if (! $enabled) {
            CurrentPasswordGuard::assertCorrect($user, (string) $request->input('current_password', ''));
        }

        $user->forceFill(['two_factor_enabled' => $enabled])->save();

        Audit::log($request, $enabled ? 'two_factor_on' : 'two_factor_off', $user->id);

        return response()->json(['user' => $user->fresh()]);
    }
}
