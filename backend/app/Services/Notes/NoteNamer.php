<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

/**
 * Names a note by the business rules' naming table: the first row that matches wins (NU-6).
 *
 * @phpstan-import-type ValidatedPlan from PlanValidator
 */
final class NoteNamer
{
    /** "All due within 7 days" (This week). */
    private const WEEK_DAYS = 7;

    /**
     * @param  ValidatedPlan  $plan
     * @param  array<string, array<string, mixed>>  $tasks  the plan's tasks by id
     */
    public function name(array $plan, string $text, NoteContext $context, array $tasks): string
    {
        $creates = $plan['create'];
        $changes = [...$plan['update'], ...$plan['delete']];
        $name = $this->oneTask($creates, $changes)
            ?? $this->oneChange($creates, $changes, $tasks)
            ?? $this->onlyChanges($creates, $changes)
            ?? $this->allTasksAlike($creates, $changes, $context)
            ?? $this->firstAndMore($creates, $changes)
            ?? $text;

        return $this->shorten(mb_strtoupper(mb_substr($name, 0, 1)).mb_substr($name, 1));
    }

    /**
     * @param  list<array<string, mixed>>  $creates
     * @param  list<array<string, mixed>>  $changes
     */
    private function oneTask(array $creates, array $changes): ?string
    {
        return count($creates) === 1 && $changes === [] ? $creates[0]['title'] : null;
    }

    /**
     * @param  list<array<string, mixed>>  $creates
     * @param  list<array<string, mixed>>  $changes
     * @param  array<string, array<string, mixed>>  $tasks
     */
    private function oneChange(array $creates, array $changes, array $tasks): ?string
    {
        if ($creates !== [] || count($changes) !== 1) {
            return null;
        }

        return $this->text('notes.name.one_change', ['title' => $tasks[$changes[0]['task_id']]['title'] ?? $changes[0]['label']]);
    }

    /**
     * @param  list<array<string, mixed>>  $creates
     * @param  list<array<string, mixed>>  $changes
     */
    private function onlyChanges(array $creates, array $changes): ?string
    {
        return $creates === [] && count($changes) > 1 ? $this->text('notes.name.only_changes', ['count' => count($changes)]) : null;
    }

    /**
     * One project, one due day, or all within a week.
     *
     * @param  list<array<string, mixed>>  $creates
     * @param  list<array<string, mixed>>  $changes
     */
    private function allTasksAlike(array $creates, array $changes, NoteContext $context): ?string
    {
        if ($creates === [] || $changes !== []) {
            return null;
        }
        $projects = array_values(array_unique(array_column($creates, 'project_id')));
        if (count($projects) === 1 && $projects[0] !== null && isset($context->projects[$projects[0]])) {
            return $this->text('notes.name.project', ['project' => $context->projects[$projects[0]]]);
        }
        $dates = array_column($creates, 'due_date');
        if ($dates === [] || in_array(null, $dates, true)) {
            return null;
        }
        $today = $context->today()->format('Y-m-d');
        if (count(array_unique($dates)) === 1) {
            return match ($dates[0]) {
                $today => $this->text('notes.name.today'),
                $context->today()->modify('+1 day')->format('Y-m-d') => $this->text('notes.name.tomorrow'),
                default => $this->text('notes.name.weekday', ['weekday' => (new DateTimeImmutable($dates[0]))->format('l')]),
            };
        }
        $weekEnd = $context->today()->modify('+'.self::WEEK_DAYS.' days')->format('Y-m-d');

        return min($dates) >= $today && max($dates) <= $weekEnd ? $this->text('notes.name.this_week') : null;
    }

    /**
     * @param  list<array<string, mixed>>  $creates
     * @param  list<array<string, mixed>>  $changes
     */
    private function firstAndMore(array $creates, array $changes): ?string
    {
        return $creates === [] ? null : $this->text('notes.name.more', ['title' => $creates[0]['title'], 'count' => count($creates) + count($changes) - 1]);
    }

    /** Names longer than the limit are cut at a word boundary with an ellipsis. */
    private function shorten(string $name): string
    {
        $limit = (int) config('notes.name_limit');
        if (mb_strlen($name) <= $limit) {
            return $name;
        }
        $cut = mb_strrpos(mb_substr($name, 0, $limit + 1), ' ') ?: $limit;

        return rtrim(mb_substr($name, 0, $cut)).$this->text('notes.name.ellipsis');
    }

    /** @param array<string, string|int> $replace */
    private function text(string $key, array $replace = []): string
    {
        $text = __($key, $replace);

        return is_string($text) ? $text : $key;
    }
}
