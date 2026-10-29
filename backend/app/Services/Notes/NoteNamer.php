<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

final class NoteNamer
{
    /**
     * @param  array<string, mixed>  $plan
     * @param  array<string, array<string, mixed>>  $tasks
     */
    public function name(array $plan, string $text, NoteContext $context, array $tasks): string
    {
        $creates = $plan['create'];
        $changes = [...$plan['update'], ...$plan['delete']];
        $name = '';
        if (count($creates) === 1 && $changes === []) {
            $name = $creates[0]['title'];
        } elseif ($creates === [] && count($changes) === 1) {
            $name = 'Update: '.($tasks[$changes[0]['task_id']]['title'] ?? $changes[0]['label']);
        } elseif ($creates === [] && count($changes) > 1) {
            $name = 'Updates to '.count($changes).' tasks';
        } elseif ($creates !== [] && $changes === []) {
            $projects = array_unique(array_column($creates, 'project_id'));
            $dates = array_column($creates, 'due_date');
            if (count($projects) === 1 && $projects[0] !== null) {
                $name = ($context->projects[$projects[0]] ?? '').' to-dos';
            } elseif (count(array_unique($dates)) === 1 && $dates[0] !== null) {
                $name = match ($dates[0]) {
                    $context->local()->format('Y-m-d') => "Today's plan",
                    $context->local()->modify('+1 day')->format('Y-m-d') => "Tomorrow's plan",
                    default => (new DateTimeImmutable($dates[0]))->format('l').' plan',
                };
            } elseif ($dates !== [] && ! in_array(null, $dates, true) && min($dates) >= $context->local()->format('Y-m-d') && max($dates) <= $context->local()->modify('+7 days')->format('Y-m-d')) {
                $name = 'This week';
            }
        }
        if ($name === '') {
            $name = $creates !== [] ? $creates[0]['title'].' + '.(count($creates) + count($changes) - 1).' more' : $text;
        }
        $name = mb_strtoupper(mb_substr($name, 0, 1)).mb_substr($name, 1);
        if (mb_strlen($name) > 34) {
            $cut = mb_strrpos(mb_substr($name, 0, 35), ' ') ?: 34;
            $name = rtrim(mb_substr($name, 0, $cut)).'…';
        }

        return $name;
    }
}
