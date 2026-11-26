<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ApiError;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

// #196: what a personal access token may reach. `abilities:a,b` needs every listed ability;
// `session-only` (no abilities) admits no token at all. The app's session is never restricted
class TokenAbilities
{
    public function handle(Request $request, Closure $next, string ...$abilities): Response
    {
        $user = $request->user();
        $token = $user instanceof User ? $user->currentAccessToken() : null;

        if ($token instanceof PersonalAccessToken
            && ($abilities === [] || array_filter($abilities, fn (string $ability) => $token->cant($ability)) !== [])) {
            throw ApiError::tokenNotAllowed();
        }

        return $next($request);
    }
}
