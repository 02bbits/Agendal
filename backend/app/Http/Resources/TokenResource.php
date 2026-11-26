<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * A personal access token (#196), never its secret.
 *
 * @mixin PersonalAccessToken
 */
class TokenResource extends JsonResource
{
    public static $wrap = null;

    /** @return array{id: int, name: string, abilities: list<string>, last_used_at: string|null, expires_at: string|null, created_at: string|null} */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'name' => (string) $this->name,
            'abilities' => array_values((array) $this->abilities),
            'last_used_at' => $this->last_used_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
