<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Services\Push\PushEndpoint;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A browser's PushSubscription (TK-6). SC-18: only HTTPS endpoints on known push services;
 * the keys must look like the browser's (base64url P-256 public key and 16-byte secret).
 */
class StorePushSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'endpoint' => ['required', 'string', 'max:2048', function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || ! PushEndpoint::allowed($value)) {
                    $fail(__('push.endpoint_not_allowed'));
                }
            }],
            'keys' => ['required', 'array:p256dh,auth'],
            // 65-byte uncompressed P-256 point, base64url: 87 characters (88 padded)
            'keys.p256dh' => ['required', 'string', 'between:87,88', 'regex:/^[A-Za-z0-9_-]+=?$/'],
            // 16 random bytes, base64url: 22 characters (24 padded)
            'keys.auth' => ['required', 'string', 'between:22,24', 'regex:/^[A-Za-z0-9_-]+={0,2}$/'],
        ];
    }
}
