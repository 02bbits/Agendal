<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Services\Clock\ReminderCalculator;
use DateTimeImmutable;

final class FieldExtractor
{
    private const KEYWORDS = [
        'SQL Course' => 'sql|database|er diagram', 'Adv Web' => 'web', 'HCI' => 'hci',
        'Portfolio' => 'portfolio', 'Personal' => 'gym|mum|groceries|mẹ|chợ',
    ];

    public function __construct(
        private NoteDateParser $dates,
        private NoteTimeParser $times,
        private ReminderCalculator $reminders,
    ) {}

    /** @return array<string, mixed> */
    public function extract(string $text, NoteContext $context): array
    {
        $time = $this->times->parse($text, $context);
        $date = $this->dates->parse($text, $context, $time['start']);
        $today = $context->local()->format('Y-m-d');
        $due = $date['date'];
        $title = $text;
        foreach (array_unique([$date['phrase'], $time['phrase']]) as $phrase) {
            if ($phrase !== '') {
                $title = (string) preg_replace(NoteVocabulary::pattern(preg_quote($phrase, '~')), ' ', $title, 1);
            }
        }
        $repeat = 'never';
        $repeats = ['daily' => 'every day|daily|mỗi ngày|hằng ngày|hàng ngày', 'weekly' => 'every week|weekly|mỗi tuần|hằng tuần', 'monthly' => 'every month|monthly|mỗi tháng|hằng tháng'];
        foreach ($repeats as $value => $phrases) {
            if (preg_match(NoteVocabulary::pattern($phrases), $title)) {
                $repeat = $value;
                $title = (string) preg_replace(NoteVocabulary::pattern($phrases), ' ', $title);
            }
        }
        if (preg_match(NoteVocabulary::pattern('(?:every|mỗi)\s+(?:'.NoteDateParser::WEEKDAYS.')'), $text)) {
            $repeat = 'weekly';
        }
        if ($due === null && ($time['start'] !== null || $repeat !== 'never')) {
            $due = $time['start'] !== null && $time['start'] <= $context->local()->format('H:i')
                ? $context->local()->modify('+1 day')->format('Y-m-d') : $today;
        }
        $contentHigh = 'deadline|exam|quiz|submit|hạn chót|thi|kiểm tra|nộp';
        $pureHigh = 'urgent|asap|important|high priority|gấp|khẩn|quan trọng|ưu tiên';
        $pureLow = 'low priority|whenever|someday|maybe|không gấp|khi nào rảnh';
        $hasLow = preg_match(NoteVocabulary::pattern($pureLow), $title) === 1;
        $withoutLow = (string) preg_replace(NoteVocabulary::pattern($pureLow), ' ', $title);
        $high = preg_match(NoteVocabulary::pattern($contentHigh.'|'.$pureHigh), $withoutLow) === 1;
        $priority = $high ? 'high' : ($hasLow ? 'low' : ($due === $today ? 'medium' : 'low'));
        $title = (string) preg_replace(NoteVocabulary::pattern($pureLow.'|'.$pureHigh), ' ', $title);
        $project = $this->project($text, $context);
        foreach ($context->projects as $name) {
            $title = (string) preg_replace_callback(NoteVocabulary::pattern(preg_quote($name, '~')), fn (): string => $name, $title);
        }
        $title = (string) preg_replace('~^(?:remember to|i need to|please|cần phải|nhớ|phải|cần)(?!\p{L})\s*~iu', '', trim($title));
        $title = trim((string) preg_replace('/\s+/u', ' ', $title), " \t\n\r\0\x0B,;:.!–-");
        $title = (string) preg_replace_callback(NoteVocabulary::pattern('sql|hci|cv|ui|api|pdf|er'), fn (array $m): string => mb_strtoupper($m[0]), $title);
        $title = mb_strtoupper(mb_substr($title, 0, 1)).mb_substr($title, 1);
        $notes = null;
        if (mb_strlen($title) > 200) {
            $cut = mb_strrpos(mb_substr($title, 0, 201), ' ') ?: 200;
            $notes = trim(mb_substr($title, $cut));
            $title = trim(mb_substr($title, 0, $cut));
        }
        $exam = preg_match(NoteVocabulary::pattern('exam|quiz|thi|kiểm tra'), $text) === 1;
        $reminder = $exam ? '1d' : ($time['start'] !== null ? '15m' : 'none');
        if ($due === null || ($reminder !== 'none' && new DateTimeImmutable((string) $this->reminders->compute($due, $time['start'], $reminder, $context->timezone)) < $context->now)) {
            $reminder = 'none';
        }

        return [
            'title' => $title, 'due_date' => $due, 'start_time' => $time['start'], 'end_time' => $time['end'],
            'priority' => $priority, 'project_id' => $project, 'repeat' => $repeat, 'reminder' => $reminder,
            'notes' => $notes, 'duplicate_of' => null, 'low_confidence' => $date['low'] || $time['low'] || $this->lowConfidence($text),
        ];
    }

    private function project(string $text, NoteContext $context): ?string
    {
        $matches = [];
        foreach ($context->projects as $id => $name) {
            if (preg_match(NoteVocabulary::pattern(preg_quote($name, '~')), $text, $m, PREG_OFFSET_CAPTURE)) {
                $matches[$id] = $m[0][1];
            }
        }
        if ($matches !== []) {
            asort($matches);

            return (string) array_key_first($matches);
        }
        foreach (self::KEYWORDS as $name => $words) {
            $id = array_search($name, $context->projects, true);
            if ($id !== false && preg_match(NoteVocabulary::pattern($words), $text)) {
                return (string) $id;
            }
        }

        return null;
    }

    private function lowConfidence(string $text): bool
    {
        // Unknown language/undecorated Vietnamese is preserved; numeric extraction still works.
        return ! NoteVocabulary::startsWithVerb($text)
            && preg_match(NoteVocabulary::pattern('sql|hci|gym|exam|quiz|report|meeting|stretch|dentist|haircut|rent|passport|database|adv web|portfolio'), $text) !== 1;
    }
}
