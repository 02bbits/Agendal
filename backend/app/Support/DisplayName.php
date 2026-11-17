<?php

namespace App\Support;

use Closure;

// The rules for a display name set in Setup or Settings (PR #153 review): 3 to 30 characters
// once trimmed, with no control, invisible or text-direction characters and no angle brackets.
// The emoji joiner (U+200D) stays allowed. The client checks the same, but only this counts.
final class DisplayName
{
    public const LENGTH = 'Use 3 to 30 characters.';

    public const INVALID = "Use letters, numbers, spaces and emoji. Angle brackets and hidden characters aren't allowed.";

    /** @return array<int, mixed> */
    public static function rules(): array
    {
        return ['string', function (string $attribute, mixed $value, Closure $fail) {
            $name = trim((string) $value);
            $length = mb_strlen($name);
            if ($length < 3 || $length > 30) {
                $fail(self::LENGTH);

                return;
            }
            if (preg_match('/[\p{Cc}\p{Zl}\p{Zp}<>]|(?!\x{200D})\p{Cf}/u', $name) === 1) {
                $fail(self::INVALID);
            }
        }];
    }
}
