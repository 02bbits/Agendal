<?php

/**
 * ADR-006: the note engine reads time only from NoteContext, so a note gives the same plan whenever it is
 * tested. A direct clock read anywhere in app/Services/Notes fails here, not in a review. hrtime() is allowed:
 * it only measures elapsed time (the SEC-23 budget) and cannot tell the date.
 */
function clockReads(string $source): array
{
    preg_match_all('~new\s+\\\\?DateTime(?:Immutable)?\(\s*(?:\)|[\'"](?:now|today|tomorrow|yesterday|midnight)\b)|(?<!->)(?<!::)(?<!function )(?<![\w$])(?:now|today|time|date|strtotime|mktime|microtime)\(|Carbon(?:Immutable)?::(?:now|today|tomorrow|yesterday)\b~i', $source, $found);

    return $found[0];
}

it('reads no clock but the note context', function (string $file) {
    expect(clockReads((string) file_get_contents($file)))->toBe([], basename($file));
})->with(fn (): array => glob(__DIR__.'/../../../app/Services/Notes/*.php') ?: []);

it('catches every direct clock read', function (string $code) {
    expect(clockReads($code))->not->toBe([]);
})->with(["new DateTimeImmutable('today')", 'new \DateTime()', "new DateTimeImmutable('now')", 'now()', 'today()', 'time()', "date('Y')", "strtotime('+1 day')", 'Carbon::now()', 'CarbonImmutable::today()', 'microtime(true)']);

it('allows the note context and parsing a given date', function (string $code) {
    expect(clockReads($code))->toBe([]);
})->with(['$context->today()', '$context->now', 'new DateTimeImmutable($date)', 'private function today(): string', 'a date (NU-E6)', '$this->times->parse($when)', 'hrtime(true)']);
