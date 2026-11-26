<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Http\Resources\TokenResource;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Support\Audit;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Response as DocsResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

// #196: personal access tokens for API clients other than the app. Session only (routes/api.php):
// a token can't make or list tokens
class TokenController extends Controller
{
    public const ABILITIES = ['tasks:read', 'tasks:write', 'projects:read', 'projects:write', 'notes:read', 'notes:write'];

    public const EXPIRY_DAYS = [7, 30, 90];

    // Bounds what a stolen session can hand out, and the per-token rate limit an account can add up to
    public const MAX_TOKENS = 10;

    /** @response list<TokenResource> */
    public function index(Request $request): JsonResponse
    {
        // A plain list, like GET /projects
        return response()->json(TokenResource::collection($this->user($request)->tokens()->latest('id')->get())->resolve());
    }

    /**
     * Make a token.
     *
     * From this page: sign in to the app in the same browser and press Send; the session goes with it,
     * and the browser's same-origin request needs no CSRF value. Copy `plain_text_token`: it is shown
     * only in this response. Use it from a script (`Authorization: Bearer …`), not on this page, where
     * your session is sent too and takes precedence. At most 10 unexpired tokens per account.
     */
    #[BodyParameter('expires_in_days', 'Days until it expires.', type: '7|30|90', default: 30)]
    #[DocsResponse(201, 'The token, with its secret this once.', type: 'array{token: TokenResource, plain_text_token: string}')]
    public function store(Request $request, ClockInterface $clock): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'abilities' => ['required', 'array', 'min:1'],
            'abilities.*' => ['string', 'distinct', Rule::in(self::ABILITIES)],
            'expires_in_days' => ['sometimes', 'integer', Rule::in(self::EXPIRY_DAYS)],
        ]);
        $user = $this->user($request);
        $days = (int) ($input['expires_in_days'] ?? 30);

        $now = $clock->now();
        // The user row lock serialises two makes at once, so the cap can't be overshot
        $token = DB::transaction(function () use ($user, $input, $now, $days) {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            if ($user->tokens()->where('expires_at', '>', $now)->count() >= self::MAX_TOKENS) {
                throw new ApiError('auth.token_limit', 'You have '.self::MAX_TOKENS.' tokens. Revoke one to make another.', 422);
            }

            return $user->createToken($input['name'], $input['abilities'], $now->modify("+{$days} days"));
        });
        Audit::log($request, 'token_created', $user->id);

        return response()->json([
            'token' => new TokenResource($token->accessToken),
            'plain_text_token' => $token->plainTextToken,
        ], 201);
    }

    public function destroy(Request $request, string $id): Response
    {
        // Someone else's token is a 404, like any other resource of theirs; so is an id that can't be one
        abort_unless(ctype_digit($id), 404);
        $this->user($request)->tokens()->whereKey((int) $id)->firstOrFail()->delete();
        Audit::log($request, 'token_revoked', $this->user($request)->id);

        return response()->noContent();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
