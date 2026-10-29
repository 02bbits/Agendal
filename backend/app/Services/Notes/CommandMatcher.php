<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

final class CommandMatcher
{
    public function __construct(private FieldExtractor $extractor) {}

    /** @return list<string> */
    public function words(string $text, NoteContext $context): array
    {
        $text = $this->extractor->extract($text, $context)['title'];
        $text = (string) preg_replace('~^(?:'.NoteVocabulary::COMPLETE.'|'.NoteVocabulary::MOVE.'|'.NoteVocabulary::DELETE.')(?!\p{L})\s*|(?<!\p{L})(?:is done|xong rồi)$~iu', '', $text);
        $tokens = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), flags: PREG_SPLIT_NO_EMPTY) ?: [];
        $stop = explode('|', 'a|an|the|to|for|my|of|on|in|at|with|and|or|task|cái|các|những|của|cho|với|và|là|việc|sang|qua|đến');

        return array_values(array_unique(array_diff($tokens, $stop)));
    }

    /** @param list<string> $words */
    public function score(array $words, string $title): float
    {
        $titleWords = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($title), flags: PREG_SPLIT_NO_EMPTY) ?: [];

        return $words === [] ? 0.0 : count(array_intersect($words, $titleWords)) / count($words);
    }

    /**
     * @param  list<array<string, mixed>>  $tasks
     * @param  list<array<string, mixed>>  $done
     * @return array<string, mixed>
     */
    public function match(string $text, string $action, array $tasks, array $done, NoteContext $context): array
    {
        $words = $this->words($text, $context);
        $scores = [];
        foreach ($tasks as $task) {
            if (($task['done'] ?? false) || ($task['deleted_at'] ?? null) !== null) {
                continue;
            }
            $score = $this->score($words, $task['title']);
            if ($score >= 0.6) {
                $scores[] = ['task' => $task, 'score' => $score];
            }
        }
        usort($scores, fn (array $a, array $b): int => ($b['score'] <=> $a['score']) ?: strcmp($a['task']['due_date'] ?? '9999-12-31', $b['task']['due_date'] ?? '9999-12-31') ?: strcmp($a['task']['id'], $b['task']['id']));
        if ($scores === []) {
            foreach ($done as $task) {
                if ($this->score($words, $task['title']) >= 0.6) {
                    return ['skip' => 'already_done'];
                }
            }
            if ($action !== 'reschedule') {
                return ['skip' => 'not_found'];
            }
            $text = (string) preg_replace('~^(?:'.NoteVocabulary::MOVE.')\s+~iu', '', $text);
            $text = (string) preg_replace(NoteVocabulary::pattern('to|sang|qua|đến'), '', $text);

            return ['create' => $this->extractor->extract($text, $context)];
        }
        $task = $scores[0]['task'];
        $ties = array_values(array_filter($scores, fn (array $row): bool => $row['score'] === $scores[0]['score']));
        $entry = ['task_id' => $task['id'], 'label' => $action === 'complete' ? 'Completed' : $task['title']];
        if ($action === 'complete') {
            $entry['done'] = true;
        } elseif ($action === 'reschedule') {
            $target = $this->extractor->extract($text, $context);
            if ($target['due_date'] !== null) {
                $entry['due_date'] = $target['due_date'];
                $entry['label'] = 'Due '.$this->display($target['due_date']).' (was '.$this->was($task['due_date'] ?? null, $context).')';
            }
            if ($target['start_time'] !== null) {
                $entry['start_time'] = $target['start_time'];
                if (($task['start_time'] ?? null) !== null && ($task['end_time'] ?? null) !== null) {
                    $start = new DateTimeImmutable('2000-01-01T'.$task['start_time']);
                    $end = new DateTimeImmutable('2000-01-01T'.$task['end_time']);
                    $shifted = (new DateTimeImmutable('2000-01-01T'.$target['start_time']))->modify('+'.($end->getTimestamp() - $start->getTimestamp()).' seconds');
                    $entry['end_time'] = $shifted->format('Y-m-d') === '2000-01-01' ? $shifted->format('H:i') : null;
                }
            }
        }

        return ['entry' => $entry, 'kind' => $action === 'delete' ? 'delete' : 'update', 'candidates' => count($ties) > 1 ? array_slice(array_column(array_column($ties, 'task'), 'id'), 0, 5) : []];
    }

    private function was(?string $date, NoteContext $context): string
    {
        return match ($date) {
            null => 'no date', $context->local()->format('Y-m-d') => 'today',
            $context->local()->modify('+1 day')->format('Y-m-d') => 'tomorrow', default => $this->display($date),
        };
    }

    private function display(string $date): string
    {
        return (new DateTimeImmutable($date))->format('D j M');
    }
}
