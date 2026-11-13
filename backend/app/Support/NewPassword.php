<?php

namespace App\Support;

use App\Exceptions\ApiError;
use Closure;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Support\Str;

// The rules for a new password at sign-up and reset (AA §2.1, BR-17, SC-02)
final class NewPassword
{
    private const RULE = 'At least 8 characters, and not your email.';

    private const ACCENTED = "Passwords can't have accented letters. Turn off Vietnamese typing and type it again.";

    private const BREACHED = 'This password has appeared in a data breach. Choose another one.';

    /**
     * Validation rules for `password`, given the account's lower-cased email.
     *
     * @return array<int, mixed>
     */
    public static function rules(string $email): array
    {
        return ['required', 'string', 'min:8', 'max:128', function (string $attribute, mixed $value, Closure $fail) use ($email) {
            if (Str::lower((string) $value) === $email) {
                $fail("Your password can't be your email."); // T-AA-108
            }
            // Vietnamese typing (Unikey, EVKey) turns keys into accented letters even in a hidden
            // field, so a new password can't have Latin letters with accents (AA §2.10)
            // (combining marks too, so a decomposed "a" + accent is caught without intl)
            if (preg_match('/[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}\x{0300}-\x{036F}]/u', (string) $value) === 1) {
                $fail(self::ACCENTED);
            }
        }];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return ['password.min' => self::RULE, 'password.max' => self::RULE];
    }

    /** Fails open when the breach service is down (AA-E10). */
    public static function assertNotBreached(string $password): void
    {
        if (! app(UncompromisedVerifier::class)->verify(['value' => $password, 'threshold' => 0])) {
            throw new ApiError('auth.password_breached', self::BREACHED, 422, ['password' => [self::BREACHED]]);
        }
    }
}
