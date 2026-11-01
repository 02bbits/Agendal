<?php

declare(strict_types=1);

namespace Tests\Support;

/** Runs a whole dataset inside one test, so the app boots once instead of once per case. */
final class Cases
{
    /**
     * @param  iterable<string|int, array<mixed>>  $cases
     * @param  callable(mixed...): mixed  $check  null when the case holds, otherwise what it got
     * @return array<string|int, mixed> the failing cases by name, with what each got
     */
    public static function failing(iterable $cases, callable $check): array
    {
        $failing = [];
        foreach ($cases as $name => $case) {
            $got = $check(...array_values($case));
            if ($got !== null) {
                $failing[$name] = $got;
            }
        }

        return $failing;
    }
}
