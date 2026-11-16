<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

// The `email` field trimmed and lower-cased (AA-E1). Anything that is not text is handed back
// as it came, so validation answers 422 instead of a cast failing with a 500 (PR #153 review).
final class EmailInput
{
    public static function from(Request $request): mixed
    {
        $email = $request->input('email');

        return is_string($email) ? Str::lower(trim($email)) : $email;
    }

    /** For a rate-limit key: empty when the field is not text. */
    public static function key(Request $request): string
    {
        $email = self::from($request);

        return is_string($email) ? $email : '';
    }
}
