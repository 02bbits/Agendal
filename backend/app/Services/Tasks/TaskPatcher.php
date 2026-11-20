<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Support\Stamp;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Validation\ValidationException;

class TaskPatcher
{
    public function __construct(
        private readonly ClockInterface $clock,
        private readonly ReminderCalculator $reminders,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function patch(Task $task, array $payload, string $timezone): Task
    {
        // 1. Project ownership check (404 if given and not owned/active)
        if (array_key_exists('project_id', $payload) && $payload['project_id'] !== null) {
            $project = Project::query()->whereNull('deleted_at')->find($payload['project_id']);
            if (! $project) {
                abort(404, 'This item no longer exists.');
            }
        }

        // 2. Extract patchable fields from payload & resolve per-field effectiveAt
        $patchData = [];
        /** @var array<string, DateTimeImmutable> $effectiveAtMap */
        $effectiveAtMap = [];
        $atPayload = $payload['at'] ?? null;

        foreach (Task::PATCHABLE as $field) {
            if (array_key_exists($field, $payload)) {
                $patchData[$field] = $payload[$field];
                $effectiveAtMap[$field] = $this->resolveFieldEffectiveAt($field, $atPayload);
            }
        }

        // 3. Rule 10: Same title as before (after trim) → not counted as changed (TK-E16)
        if (array_key_exists('title', $patchData) && is_string($patchData['title'])) {
            $trimmedTitle = trim($patchData['title']);
            if ($trimmedTitle === (string) $task->title) {
                unset($patchData['title']);
            } else {
                $patchData['title'] = $trimmedTitle;
            }
        }

        // 4. Initial state
        $origStartDate = $task->start_date ? substr((string) $task->start_date, 0, 10) : null;
        $origDueDate = $task->due_date ? substr((string) $task->due_date, 0, 10) : null;
        $origStartTime = $task->start_time !== null ? substr((string) $task->start_time, 0, 5) : null;
        $origDueTime = $task->due_time !== null ? substr((string) $task->due_time, 0, 5) : null;
        $origReminder = $task->reminder ?? 'none';
        $origRepeat = $task->repeat ?? 'never';
        $origRepeatAnchor = $task->repeat_anchor ? substr((string) $task->repeat_anchor, 0, 10) : null;

        $merged = [
            'title' => $task->title,
            'start_date' => $origStartDate,
            'due_date' => $origDueDate,
            'start_time' => $origStartTime,
            'due_time' => $origDueTime,
            'priority' => $task->priority,
            'reminder' => $origReminder,
            'repeat' => $origRepeat,
            'repeat_rule' => $task->repeat_rule,
            'notes' => $task->notes,
            'project_id' => $task->project_id,
        ];

        /** @var array<string, string> $fieldUpdatedAt */
        $fieldUpdatedAt = $task->field_updated_at ?? [];
        $appliedFields = [];

        // 5. Last write wins per field
        foreach ($patchData as $field => $value) {
            if ($field === 'reminder' && $value === null) {
                $value = 'none';
            }
            if ($field === 'repeat' && $value === null) {
                $value = 'never';
            }

            $storedAtStr = $fieldUpdatedAt[$field] ?? null;
            $fieldEffectiveAt = $effectiveAtMap[$field] ?? $this->resolveFieldEffectiveAt($field, $atPayload);

            if ($this->isLaterThan($fieldEffectiveAt, $storedAtStr)) {
                $merged[$field] = $value;
                $fieldUpdatedAt[$field] = Stamp::of($fieldEffectiveAt);
                $appliedFields[$field] = true;
            }
        }

        // 6. Dependent fields (TK §2.2)
        // - Clearing due_date clears due_time, and clears reminder if start_date is empty
        $dueDateWasCleared = array_key_exists('due_date', $appliedFields) && $merged['due_date'] === null;
        if ($dueDateWasCleared) {
            $dueDateEffectiveAtIso = Stamp::of($effectiveAtMap['due_date'] ?? $this->resolveFieldEffectiveAt('due_date', $atPayload));
            $merged['due_time'] = null;
            $fieldUpdatedAt['due_time'] = $dueDateEffectiveAtIso;
            if (empty($merged['start_date'])) {
                $merged['reminder'] = 'none';
                $fieldUpdatedAt['reminder'] = $dueDateEffectiveAtIso;
            }
        }

        // - Clearing start_date clears start_time, and clears reminder if due_date is empty
        $startDateWasCleared = array_key_exists('start_date', $appliedFields) && $merged['start_date'] === null;
        if ($startDateWasCleared) {
            $startDateEffectiveAtIso = Stamp::of($effectiveAtMap['start_date'] ?? $this->resolveFieldEffectiveAt('start_date', $atPayload));
            $merged['start_time'] = null;
            $fieldUpdatedAt['start_time'] = $startDateEffectiveAtIso;
            if (empty($merged['due_date'])) {
                $merged['reminder'] = 'none';
                $fieldUpdatedAt['reminder'] = $startDateEffectiveAtIso;
            }
        }

        // - repeat with neither date starts today, on the start date (#154)
        if (DueDateFallback::needed(
            is_string($merged['due_date']) ? $merged['due_date'] : null,
            is_string($merged['start_date']) ? $merged['start_date'] : null,
            (string) $merged['repeat'],
        )) {
            $merged['start_date'] = $this->clock->today($timezone);
            $fieldUpdatedAt['start_date'] = Stamp::of(array_key_exists('repeat', $effectiveAtMap) ? $effectiveAtMap['repeat'] : $this->resolveEffectiveAt(null));
        }

        // - repeat changes from never → repeat_anchor = active anchor date; repeat becomes never → repeat_anchor = null;
        //   anchor date changes while repeating → keep the anchor.
        $repeatAnchor = $origRepeatAnchor;
        $newRepeat = (string) $merged['repeat'];
        if (isset($appliedFields['repeat']) && ! isset($appliedFields['repeat_rule'])) {
            $merged['repeat_rule'] = null;
            $fieldUpdatedAt['repeat_rule'] = $fieldUpdatedAt['repeat'];
        }

        $activeAnchorDate = $merged['start_date'] ?: $merged['due_date'];

        if ($origRepeat === 'never' && $newRepeat !== 'never') {
            $repeatAnchor = $activeAnchorDate;
        } elseif ($origRepeat !== 'never' && $newRepeat === 'never') {
            $repeatAnchor = null;
        } elseif ($origRepeat !== 'never' && $newRepeat !== 'never') {
            if ($repeatAnchor === null) {
                $repeatAnchor = $activeAnchorDate;
            }
        } else {
            $repeatAnchor = null;
        }

        // 8. Validation on the merged state
        $errors = [];
        if (! RepeatSchedule::validFor($merged['repeat_rule'], $newRepeat)) {
            $errors['repeat_rule'] = ['The repeat rule must match the repeat frequency.'];
        }
        $startDate = $merged['start_date'];
        $dueDate = $merged['due_date'];
        $startTime = $merged['start_time'];
        $dueTime = $merged['due_time'];
        $reminder = (string) $merged['reminder'];

        $errors = [...$errors, ...DueDateFallback::timeErrors(
            is_string($startDate) ? $startDate : null,
            is_string($startTime) ? $startTime : null,
            is_string($dueDate) ? $dueDate : null,
            is_string($dueTime) ? $dueTime : null,
        )];

        if (! empty($startDate) && ! empty($dueDate)) {
            if ($startDate > $dueDate) {
                $errors['start_date'] = ["Start can't be after the due date."];
            } elseif ($startDate === $dueDate && $startTime !== null && $dueTime !== null) {
                $st = substr((string) $startTime, 0, 5);
                $dt = substr((string) $dueTime, 0, 5);
                if ($st >= $dt) {
                    $errors['start_time'] = ["Start can't be after the due date."];
                }
            }
        }

        if ($reminder !== 'none' && empty($startDate) && empty($dueDate)) {
            $errors['reminder'] = ['Add a date to set a reminder.'];
        }

        if (! empty($errors)) {
            throw ValidationException::withMessages($errors);
        }

        // 9. Remind_at calculation
        $scheduleOrReminderChanged = ($merged['start_date'] !== $origStartDate
            || $merged['start_time'] !== $origStartTime
            || $merged['due_date'] !== $origDueDate
            || $merged['due_time'] !== $origDueTime
            || $merged['reminder'] !== $origReminder);

        if ($scheduleOrReminderChanged) {
            if (empty($merged['start_date']) && empty($merged['due_date']) || $merged['reminder'] === 'none') {
                $task->remind_at = null;
            } else {
                $task->remind_at = $this->reminders->forDates(
                    $merged['start_date'],
                    $merged['start_time'],
                    $merged['due_date'],
                    $merged['due_time'],
                    (string) $merged['reminder'],
                    $timezone,
                );
            }
        }

        // 10. Save once (if dirty)
        $task->title = (string) $merged['title'];
        $task->start_date = $merged['start_date'];
        $task->due_date = $merged['due_date'];
        $task->start_time = $merged['start_time'];
        $task->due_time = $merged['due_time'];
        $task->priority = $merged['priority'];
        $task->reminder = (string) $merged['reminder'];
        $task->repeat = (string) $merged['repeat'];
        $task->repeat_rule = $merged['repeat_rule'];
        $task->notes = $merged['notes'];
        $task->project_id = $merged['project_id'];
        $task->repeat_anchor = $repeatAnchor;
        $task->field_updated_at = $fieldUpdatedAt;

        if ($task->isDirty()) {
            $task->save();
        }

        return $task;
    }

    /**
     * Last write wins per field (TK). A note is a server action on the locked current row, so it must win
     * even when the task was written in the same second: one second after the newest field stamp, or now.
     */
    public function afterLastWrite(Task $task): string
    {
        $at = $this->clock->now()->setTimezone(new DateTimeZone('UTC'));
        foreach ($task->field_updated_at ?? [] as $stamp) {
            $at = max($at, Stamp::time((string) $stamp)->modify('+1 millisecond'));
        }

        return Stamp::of($at);
    }

    public function resolveFieldEffectiveAt(string $field, mixed $atPayload): DateTimeImmutable
    {
        if (is_array($atPayload)) {
            if (isset($atPayload[$field]) && is_string($atPayload[$field])) {
                return $this->resolveEffectiveAt($atPayload[$field]);
            }

            return $this->resolveEffectiveAt(null);
        }

        if (is_string($atPayload)) {
            return $this->resolveEffectiveAt($atPayload);
        }

        return $this->resolveEffectiveAt(null);
    }

    public function resolveEffectiveAt(?string $at): DateTimeImmutable
    {
        $now = $this->clock->now()->setTimezone(new DateTimeZone('UTC'));
        $maxAhead = $now->modify('+5 minutes');

        if ($at !== null && $at !== '') {
            $parsedAt = (new DateTimeImmutable($at))->setTimezone(new DateTimeZone('UTC'));

            return $parsedAt > $maxAhead ? $maxAhead : $parsedAt;
        }

        return $now;
    }

    /** Last write wins per field: to the millisecond, then by device (`Stamp::wins`). */
    public function isLaterThan(DateTimeImmutable $effectiveAt, ?string $storedAtStr): bool
    {
        return Stamp::wins(Stamp::of($effectiveAt), $storedAtStr);
    }

    public function complete(Task $task, ?string $at): Task
    {
        if ($task->done) {
            return $task;
        }

        $effectiveAt = $this->resolveEffectiveAt($at);
        $effectiveAtIso = $effectiveAt->format('Y-m-d\TH:i:s.v\Z');

        /** @var array<string, string> $fieldUpdatedAt */
        $fieldUpdatedAt = $task->field_updated_at ?? [];
        $storedDoneAt = $fieldUpdatedAt['done'] ?? null;

        if ($this->isLaterThan($effectiveAt, $storedDoneAt)) {
            $task->done = true;
            $task->done_at = $effectiveAtIso;
            $fieldUpdatedAt['done'] = Stamp::of($effectiveAt);
            $task->field_updated_at = $fieldUpdatedAt;
            $task->save();
        }

        return $task;
    }

    public function reopen(Task $task, ?string $at): Task
    {
        $effectiveAt = $this->resolveEffectiveAt($at);
        $effectiveAtIso = $effectiveAt->format('Y-m-d\TH:i:s.v\Z');

        /** @var array<string, string> $fieldUpdatedAt */
        $fieldUpdatedAt = $task->field_updated_at ?? [];
        $storedDoneAt = $fieldUpdatedAt['done'] ?? null;

        if ($this->isLaterThan($effectiveAt, $storedDoneAt)) {
            $task->done = false;
            $task->done_at = null;
            $fieldUpdatedAt['done'] = Stamp::of($effectiveAt);
            $task->field_updated_at = $fieldUpdatedAt;
            $task->save();
        }

        return $task;
    }
}
