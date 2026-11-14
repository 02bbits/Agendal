<?php

namespace App\Support;

use App\Exceptions\ApiError;
use Closure;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Support\Str;

// The rules for a new password at sign-up and reset (AA §2.1, BR-17, SC-02)
final class NewPassword
{
    private const RULE = "At least 8 characters, and doesn't contain your information.";

    private const ACCENTED = 'Use only English keyboard characters, spaces and emoji. Turn off Vietnamese typing and type it again.';

    private const BREACHED = 'This password has appeared in a data breach. Choose another one.';

    /**
     * Validation rules for `password`, given the account's lower-cased email.
     *
     * @return array<int, mixed>
     */
    public static function rules(string $email): array
    {
        // bail: a list or object stops at "string", so the check below only ever sees text
        return ['bail', 'required', 'string', 'min:8', 'max:128', function (string $attribute, mixed $value, Closure $fail) use ($email) {
            // Not the email, and not containing its name part (3+ characters): "doesn't contain
            // your information" (T-AA-108)
            $lower = Str::lower((string) $value);
            $name = Str::before($email, '@');
            if ($lower === $email || (mb_strlen($name) >= 3 && str_contains($lower, $name))) {
                $fail("Your password can't contain your email.");
            }
            // Only what an English keyboard types (printable ASCII, space included) and emoji.
            // Vietnamese typing (Unikey, EVKey) turns keys into accented letters even in a hidden
            // field, so those and any other script are refused (AA §2.10). Emoji keep their
            // joiners, variation selector, skin tones, flags and keycaps (AA-E9)
            if (preg_match('/[^\x20-\x7E\p{Extended_Pictographic}\x{FE0F}\x{200D}\x{1F3FB}-\x{1F3FF}\x{1F1E6}-\x{1F1FF}\x{20E3}]/u', (string) $value) === 1) {
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
