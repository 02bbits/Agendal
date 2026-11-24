<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Validation\ValidationException;
use Normalizer;
use RuntimeException;

final class NoteSplitter
{
    /** Text with a letter, digit or symbol (emoji) is visible; punctuation and spaces alone are not. */
    private const VISIBLE = '/[\p{L}\p{N}\p{So}]/u';

    public function normalize(string $text): string
    {
        $text = (string) preg_replace('/\r\n?|[\x{85}\x{2028}\x{2029}]/u', "\n", $text);
        $text = Normalizer::normalize($text, Normalizer::FORM_C) ?: $text;
        $text = (string) preg_replace('/[^\P{Cc}\t\n]|\p{Cf}/u', '', $text);
        $text = trim((string) preg_replace('/[^\S\t\n]/u', ' ', $text));
        if (preg_match(self::VISIBLE, $text) !== 1) {
            throw ValidationException::withMessages(['text' => ['note.empty']]);
        }
        if (mb_strlen($text) > (int) config('notes.max_length')) {
            throw ValidationException::withMessages(['text' => ['note.too_long']]);
        }

        return $text;
    }

    /**
     * Markdown from a pasted note: "### 7. Title" and a wholly bold line ("**Meeting notes**") are headings, so they
     * end with the heading suffix and make no task; bold and underline marks elsewhere are dropped.
     */
    private function withoutMarkdown(string $line): string
    {
        $heading = '~^\s{0,3}(?:'.NoteVocabulary::phrases('markdown_heading').')+\s+~u';
        $emphasis = '(?:'.NoteVocabulary::phrases('markdown_emphasis').')';
        $isHeading = preg_match($heading, $line) === 1 || preg_match('~^\s*('.$emphasis.')\S.*\1\s*$~u', $line) === 1;
        $line = trim((string) preg_replace(['~('.$emphasis.')(\S(?:.*?\S)?)\1~u', $heading], ['$2', ''], $line));
        $endsAsHeading = preg_match('~(?:'.NoteVocabulary::phrases('heading_suffix').')$~u', $line) === 1;

        return $isHeading && ! $endsAsHeading ? $line.NoteVocabulary::values('heading_suffix')[0] : $line;
    }

    /**
     * @param  list<string>  $projects
     * @return list<string>
     */
    public function split(string $text, array $projects = []): array
    {
        $text = $this->normalize($text);
        $projects = array_values(array_filter(
            array_map(fn (string $project): string => trim(Normalizer::normalize($project, Normalizer::FORM_C) ?: $project), $projects),
            fn (string $project): bool => $project !== '',
        ));
        $checkboxes = [];
        foreach (NoteVocabulary::values('checkbox_bracket') as $pair) {
            $brackets = mb_str_split($pair);
            if (count($brackets) !== 2) {
                throw new RuntimeException('A checkbox_bracket rule needs one opening and one closing character: '.$pair);
            }
            $checkboxes[] = preg_quote($brackets[0], '~').'\s*(?:'.NoteVocabulary::phrases('checkbox_mark').')?\s*'.preg_quote($brackets[1], '~');
        }
        // "bullet" needs a space after it ("- buy", not "-5"); "tight_bullet" may touch the text ("•buy").
        $bullets = '~^\s*(?:(?:'.NoteVocabulary::phrases('bullet').')\s+|(?:'.NoteVocabulary::phrases('tight_bullet').')\s*|(?:\d+(?:'.NoteVocabulary::phrases('number_suffix').')|\p{L}(?:'.NoteVocabulary::phrases('letter_suffix').'))\s+|(?:'.implode('|', $checkboxes).')\s*)+~iu';
        $notAbbreviation = '';
        foreach (NoteVocabulary::values('abbreviation') as $abbreviation) {
            $notAbbreviation .= '(?<!\b'.preg_quote($abbreviation, '~').')';
        }
        // A sequence word glued to an email, file name or URL character ("then@x.com", "x.com/then") is not a split.
        $attachment = NoteVocabulary::phrases('word_attachment');
        $word = '(?<![\p{L}\p{N}_])(?<!'.$attachment.')';
        $delimiter = '~(*UCP)(?:'.NoteVocabulary::phrases('separator').')|'.$word.'(?:'.NoteVocabulary::phrases('conjunction').')(?![\p{L}\p{N}_])(?!(?:'.$attachment.')[\p{L}\p{N}])|'.$word.'(?:'.NoteVocabulary::phrases('following_conjunction').')\s+(?=\S)|'.$notAbbreviation.'(?:'.NoteVocabulary::phrases('full_stop').')+(?=\s|$)~iu';
        $commas = NoteVocabulary::phrases('comma');
        $joiner = NoteVocabulary::phrases('list_joiner');
        // Words that may end an item between two tasks: "and" (#156) and "but".
        $words = NoteVocabulary::phrases('task_joiner').'|'.NoteVocabulary::phrases('contrast_joiner');
        $items = [];
        foreach (explode("\n", $text) as $line) {
            $line = (string) preg_replace($bullets, '', $this->withoutMarkdown($line));
            $end = null;
            foreach (preg_split($delimiter, $line, -1, PREG_SPLIT_OFFSET_CAPTURE) ?: [] as [$chunk, $start]) {
                // What split this chunk from the one before, as written: ". ", "; ", or a line break.
                $glue = $end === null ? ' ' : trim(substr($line, $end, $start - $end)).' ';
                $end = $start + strlen($chunk);
                $current = '';
                $comma = '';
                $masked = $chunk;
                $literals = NoteVocabulary::literals($chunk, $projects);
                foreach ($literals as [$offset, $length]) {
                    $literal = (string) preg_replace('~(?:'.$commas.')+$~u', '', substr($chunk, $offset, $length));
                    $masked = substr_replace($masked, str_repeat(' ', strlen($literal)), $offset, strlen($literal));
                }
                foreach (NoteRepeatParser::listSpans(NoteVocabulary::withoutLiterals($chunk, $projects)) as [$offset, $length]) {
                    $masked = substr_replace($masked, str_repeat(' ', $length), $offset, $length);
                }
                // Each item of the chunk, and whether "and" (not a comma) ended it.
                $parts = [];
                $byJoiner = [];
                foreach (preg_split($this->boundary($commas), $masked, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_OFFSET_CAPTURE) ?: [] as $index => [$fragment, $offset]) {
                    $fragment = substr($chunk, $offset, strlen($fragment));
                    if ($index % 2 === 1) {
                        // ", and" and ", but" are one boundary: the comma stays in the text and decides; ",," is one comma
                        $comma = preg_match('~^\s*(?:'.$words.')\s*$~iu', $fragment) === 1 ? $comma.$fragment : $fragment;

                        continue;
                    }
                    $fragment = trim($fragment);
                    if (preg_match(self::VISIBLE, $fragment) !== 1) {
                        continue;
                    }
                    // "gym every day⏎for 2 weeks", "every Mon. for 2 wks": what only goes on with the series before a
                    // line break or full stop joins it, so it is read in full or kept for review.
                    $previous = $items === [] ? '' : $items[array_key_last($items)];
                    if ($current === '' && $parts === [] && $previous !== '' && NoteRepeatParser::hasRepeat($previous) && NoteRepeatParser::continuesSchedule($fragment)) {
                        $current = (string) array_pop($items).$glue.$fragment;

                        continue;
                    }
                    $and = preg_match('~^\s*(?:'.NoteVocabulary::phrases('task_joiner').')\s*$~iu', $comma) === 1;
                    if ($and || preg_match('~^\s*(?:'.NoteVocabulary::phrases('contrast_joiner').')\s*$~iu', $comma) === 1) {
                        // "but" before a task of its own splits like "and"; otherwise it stays, and the item is hedged.
                        $joins = $current !== '' && ! $this->joinsTwoTasks($current, $fragment, $projects);
                    } else {
                        $leading = NoteVocabulary::onlyModifiers($current, $projects)
                            && ! $this->startsWithCommand(NoteVocabulary::withoutLeadIn($fragment))
                            && ! NoteVocabulary::startsWith($fragment, 'skip_prefix');
                        $joins = $current !== '' && ($leading || NoteVocabulary::onlyModifiers($fragment, $projects)
                            || $this->opensCondition($current)
                            || NoteRepeatParser::startsQualifier($fragment)
                            || ($this->opensList($current, $projects) && ! $this->startsNewTask($fragment, $projects)));
                    }
                    if ($joins) {
                        $current .= (preg_match('~^\s*(?:'.$words.')\s*$~iu', $comma) === 1 ? ' '.trim($comma) : rtrim($comma)).' '.$fragment;
                    } else {
                        $parts[] = $current;
                        $byJoiner[] = $and;
                        $current = $fragment;
                    }
                    $comma = '';
                }
                $parts[] = $current;
                $byJoiner[] = false;
                $items = [...$items, ...$this->shareClosingModifiers($parts, $byJoiner, $projects)];
            }
        }
        // Joiners left at an item edge ("buy milk and then …", ", and email boss") belong to no item.
        // A leading filler ("rồi thì gọi mẹ" leaves "thì gọi mẹ") or contrast ("However, call mum") is dropped only at the start.
        $leading = $joiner.'|'.NoteVocabulary::phrases('leading_filler').'|'.NoteVocabulary::phrases('contrast_joiner');
        $items = array_map(fn (string $item): string => trim((string) preg_replace('~^(?:(?:'.$leading.')(?:\s+|$))+|(?:(?:^|\s+)(?:'.$joiner.'))+$~iu', '', $item)), $items);
        $items = array_values(array_filter($items, fn (string $item): bool => preg_match(self::VISIBLE, $item) === 1));
        if ($items === []) {
            throw ValidationException::withMessages(['text' => ['note.empty']]);
        }
        if (count($items) > (int) config('notes.max_items')) {
            throw ValidationException::withMessages(['text' => ['note.too_many_items']]);
        }

        return $items;
    }

    /**
     * A comma or a whole-word "and" / "và" that may end an item. A comma between digits ("1,000") or between a day
     * and its year ("Oct 26, 2026", "September 1st, 2026") belongs to the number or the date, as does "and" between
     * two amounts.
     */
    private function boundary(string $commas): string
    {
        $dayEnds = array_map(fn (string $suffix): string => '\d'.preg_quote($suffix, '~'), NoteVocabulary::values('ordinal_suffix'));
        $afterDay = '(?<!\d)'.implode('', array_map(fn (string $end): string => '(?<!'.$end.')', $dayEnds));
        $words = NoteVocabulary::phrases('task_joiner').'|'.NoteVocabulary::phrases('contrast_joiner');
        // "and" between two amounts is a range ("between 2 and 3 weeks"), part of the number like "1,000".
        $joiner = '(?:(?<!\d)|(?!\s+(?:'.$words.')\s+\d))\s+(?:'.$words.')\s+';

        return '~('.$afterDay.'(?:'.$commas.')|(?:'.$commas.')(?!\d|\s*\d{4}(?!\d))|'.$joiner.')~iu';
    }

    /**
     * "and" between two tasks ends the first (issue #156): the part after it opens with a task verb or a command
     * and names an object of its own, and the part before it is more than one bare verb word. "buy milk and eggs",
     * "read and summarize chapter 3", "check email and reply" and "finish report and submit it" stay one task;
     * "đi chợ và nấu cơm" splits, as "đi chợ" names its own task.
     *
     * After a command only another command splits: whether "done email group and call mum" names a second task to
     * complete or a new one depends on the open tasks, which the command matcher reads (CommandMatcher::matchEach).
     *
     * @param  list<string>  $projects
     */
    private function joinsTwoTasks(string $before, string $after, array $projects): bool
    {
        $before = trim(NoteVocabulary::withoutLeadIn(NoteVocabulary::withoutLeadingModifiers(NoteVocabulary::withoutLeadIn($before), $projects)));
        if (preg_match(self::VISIBLE, $before) !== 1 || (preg_match('/\s/u', $before) !== 1 && NoteVocabulary::startsWithVerb($before))) {
            return false;
        }
        $commands = NoteVocabulary::phrases('complete_command').'|'.NoteVocabulary::phrases('move_command').'|'.NoteVocabulary::phrases('delete_command');
        if ($this->startsWithCommand($before)) {
            return NoteVocabulary::opensWithObject($after, $commands, $projects);
        }
        // A task that needs no object ("đi chợ", "chạy bộ") is a task of its own after another task.
        $after = trim(NoteVocabulary::withoutLeadingModifiers(NoteVocabulary::withoutLeadIn(trim($after)), $projects));

        return preg_match('~^(?:'.NoteVocabulary::phrases('standalone_task').')(?![\p{L}\p{N}_])~iu', $after) === 1
            || NoteVocabulary::opensWithObject($after, NoteVocabulary::phrases('task_verb').'|'.$commands, $projects);
    }

    /**
     * A date, time, priority or repeat phrase closing the last of several tasks joined by "and" covers the earlier
     * ones that have none of their own: "clean room and do laundry tomorrow" is two tasks for tomorrow, while
     * "call mum tomorrow and email boss friday" keeps each day. Commas keep their own rule (NU §2.2).
     *
     * @param  list<string>  $parts
     * @param  list<bool>  $byJoiner  whether "and" ended each part
     * @param  list<string>  $projects
     * @return list<string>
     */
    private function shareClosingModifiers(array $parts, array $byJoiner, array $projects): array
    {
        $closing = '';
        for ($index = count($parts) - 1; $index >= 0; $index--) {
            // The nearest task with its own phrase decides for the tasks before it. A command's date is its target.
            if ($this->startsWithCommand(NoteVocabulary::withoutLeadIn($parts[$index]))) {
                $closing = '';
            } elseif (! $byJoiner[$index] || preg_match('~'.NoteVocabulary::modifierPattern().'~iu', NoteVocabulary::withoutLiterals($parts[$index], $projects)) === 1) {
                $closing = preg_match('~(?:\s*(?:'.NoteVocabulary::modifierPattern().'))+\s*$~iu', $parts[$index], $match) === 1 ? trim($match[0]) : '';
            } elseif ($closing !== '') {
                $parts[$index] .= ' '.$closing;
            }
        }

        return array_values($parts);
    }

    /**
     * A task verb ("buy milk, eggs") or a command verb ("move report, gym to friday") opens a comma list.
     *
     * @param  list<string>  $projects
     */
    private function opensList(string $item, array $projects): bool
    {
        $item = NoteVocabulary::withoutLeadIn(NoteVocabulary::withoutLeadingModifiers(NoteVocabulary::withoutLeadIn($item), $projects));

        return NoteVocabulary::startsWithVerb($item) || $this->startsWithCommand($item);
    }

    /**
     * "if it rains, cancel gym", "nếu mẹ rảnh, gọi mẹ": a leading condition holds the part after its comma, so the
     * whole stays one hedged item for the fallback instead of cancelling gym outright. A leading "however" doesn't.
     */
    private function opensCondition(string $item): bool
    {
        $item = NoteVocabulary::withoutLeadIn($item);

        return NoteVocabulary::startsWith($item, 'clause_hedge') && ! NoteVocabulary::startsWith($item, 'contrast_joiner');
    }

    private function startsWithCommand(string $text): bool
    {
        return NoteVocabulary::startsWith($text, 'complete_command', 'move_command', 'delete_command');
    }

    /**
     * The fragment starts a task of its own (NU §2.2): it opens with a date, time, priority or repeat word
     * ("26 Oct meeting", "mai gọi mẹ"), a verb, a command or a skip prefix, or it names a project, one of the
     * user's project keywords (NU-E34) or a task ("quiz"). Date and time words that close a fragment describe
     * the whole list instead ("mua sữa, trứng sáng mai" is one task for tomorrow morning).
     *
     * @param  list<string>  $projects
     */
    private function startsNewTask(string $text, array $projects): bool
    {
        $text = NoteVocabulary::withoutLeadIn($text);
        if (preg_match('~^(?:'.NoteVocabulary::modifierPattern().')~iu', $text) === 1) {
            return true;
        }
        if (NoteVocabulary::startsWithVerb($text)
            || $this->startsWithCommand($text)
            || NoteVocabulary::startsWith($text, 'skip_prefix')
            || preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('complete_suffix').')$~iu', $text) === 1) {
            return true;
        }
        $names = NoteVocabulary::phrases('priority_high_content');
        $owned = array_map(mb_strtolower(...), $projects);
        foreach ($projects as $project) {
            $names .= '|'.preg_quote($project, '~');
        }
        foreach (NoteVocabulary::projectKeywords() as $project => $keywords) {
            if (in_array(mb_strtolower(trim(Normalizer::normalize($project, Normalizer::FORM_C) ?: $project)), $owned, true)) {
                $names .= '|'.$keywords;
            }
        }

        return preg_match(NoteVocabulary::pattern($names), $text) === 1;
    }
}
