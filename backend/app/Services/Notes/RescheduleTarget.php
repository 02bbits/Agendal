<?php

declare(strict_types=1);

namespace App\Services\Notes;

/**
 * Splits a reschedule into the task it names and the new when: "move 9am standup to 10am" is "move 9am standup"
 * and "10am". The last "to / sang / qua / đến" followed by a date or time splits, so "move talk to bank to friday"
 * keeps "talk to bank" and "move the boxes to the garage" has no target (NU §2.3).
 */
final class RescheduleTarget
{
    public function __construct(
        private NoteDateParser $dates,
        private NoteTimeParser $times,
    ) {}

    /** @var array<string, array<string, mixed>|null> splits and shifts by context and text; both are asked many times per command */
    private array $read = [];

    /** @return array{subject: string, when: string}|null null for no move command: "done remind me to call mom in 2 hours" has no target */
    public function split(string $text, NoteContext $context): ?array
    {
        $key = 'split|'.$context->key().'|'.$text;
        if (! array_key_exists($key, $this->read)) {
            $this->read[$key] = $this->readSplit($text, $context);
        }

        /** @var array{subject: string, when: string}|null */
        return $this->read[$key];
    }

    /** @return array{subject: string, when: string}|null */
    private function readSplit(string $text, NoteContext $context): ?array
    {
        if (! NoteVocabulary::startsWith($text, 'move_command')) {
            return null;
        }
        preg_match_all('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('reschedule_target').')\s+~iu', $text, $matches, PREG_OFFSET_CAPTURE);
        foreach (array_reverse($matches[0]) as [$target, $offset]) {
            $when = substr($text, $offset + strlen($target));
            if ($this->startsWithWhen($when, $context)) {
                return ['subject' => rtrim(substr($text, 0, $offset)), 'when' => $when];
            }
        }

        return null;
    }

    /**
     * "friday", "the 5th", "in 2 hours", "tomorrow before friday", but not "the garage on friday": only stop words
     * before the first date or time the text reads.
     */
    private function startsWithWhen(string $when, NoteContext $context): bool
    {
        $time = $this->times->parse($when, $context);
        $offsets = [...array_filter([$this->dates->firstAt($when, $context)], fn (?int $offset): bool => $offset !== null), ...($time->start === null ? [] : array_column($time->spans, 0))];
        if ($offsets === []) {
            return false;
        }
        $before = NoteVocabulary::tokens(substr($when, 0, min($offsets)));

        return array_diff($before, array_map(mb_strtolower(...), NoteVocabulary::values('stop_word'))) === [];
    }

    /**
     * A move by an amount instead of to a when (NU §2.4):
     * <move verb> [direction]* <name> [by / thêm / direction]* <amount> <unit> [direction]
     * "lùi họp nhóm 2 giờ", "push back standup by half an hour", "move standup earlier by 30 minutes", "dời họp lên
     * 1 tiếng", "kéo họp sớm hơn 30p". An earlier word makes the amount negative; none means later.
     *
     * @return array{subject: string, unit: string, amount: int}|null
     */
    public function shift(string $text): ?array
    {
        if (! array_key_exists('shift|'.$text, $this->read)) {
            $this->read['shift|'.$text] = $this->readShift($text);
        }

        /** @var array{subject: string, unit: string, amount: int}|null */
        return $this->read['shift|'.$text];
    }

    /** @return array{subject: string, unit: string, amount: int}|null */
    private function readShift(string $text): ?array
    {
        $direction = NoteVocabulary::phrases('shift_later').'|'.NoteVocabulary::phrases('shift_earlier');
        $start = '~^\s*(?:'.NoteVocabulary::phrases('move_command').')(?<lead>(?:\s+(?:'.$direction.'))*)(?![\p{L}\p{N}_])~iu';
        if (preg_match($start, $text, $verb) !== 1) {
            return null;
        }
        $numbers = implode('|', NoteVocabulary::family('amount'));
        $amount = '(?<amount>\d+|'.NoteVocabulary::phrases('amount_one').'|'.NoteVocabulary::phrases('amount_half').'|'.$numbers.')';
        foreach (self::units() as $unit => $words) {
            $pattern = '~\s+(?<before>(?:(?:'.NoteVocabulary::phrases('shift_prefix').'|'.$direction.')\s+){0,3})'.$amount.'\s*(?:'.$words.')'
                .'(?:\s+(?<after>'.$direction.'))?[\p{P}\s]*$~iu';
            if (preg_match($pattern, $text, $m, PREG_OFFSET_CAPTURE) !== 1 || $m[0][1] < strlen($verb[0])) {
                continue;
            }
            $step = $this->step($m['amount'][0], (string) $unit);
            if ($step === null) {
                return null;
            }
            $said = $verb['lead'].' '.$m['before'][0].' '.($m['after'][0] ?? '');
            $earlier = preg_match(NoteVocabulary::pattern(NoteVocabulary::phrases('shift_earlier')), $said) === 1;

            return ['subject' => rtrim(substr($text, 0, $m[0][1])), 'unit' => $step['unit'], 'amount' => ($earlier ? -1 : 1) * $step['amount']];
        }

        return null;
    }

    /**
     * "2", "two", "hai", "an", "half" with its unit as whole units: half an hour is 30 minutes, half a day 12 hours.
     *
     * @return array{unit: string, amount: int}|null
     */
    private function step(string $amount, string $unit): ?array
    {
        if (preg_match('~^(?:'.NoteVocabulary::phrases('amount_half').')$~iu', $amount) === 1) {
            return NoteDurations::half($unit);
        }
        if (ctype_digit($amount)) {
            return ['unit' => $unit, 'amount' => (int) $amount];
        }
        foreach (NoteVocabulary::family('amount') as $value => $words) {
            if (preg_match('~^(?:'.$words.')$~iu', $amount) === 1) {
                return ['unit' => $unit, 'amount' => (int) $value];
            }
        }

        return ['unit' => $unit, 'amount' => 1];
    }

    /**
     * The duration units, with the ones only a move by an amount reads ("2 giờ", "2h", "30p"): elsewhere "sau 2 giờ"
     * is 2 o'clock, not two hours.
     *
     * @return array<string, string> unit => its words
     */
    private static function units(): array
    {
        $units = NoteVocabulary::family('duration_unit');
        foreach (NoteVocabulary::family('shift_unit') as $unit => $words) {
            $units[$unit] = isset($units[$unit]) ? $units[$unit].'|'.$words : $words;
        }

        return $units;
    }
}
