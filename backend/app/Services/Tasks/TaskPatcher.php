<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Validation\ValidationException;
use Throwable;

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
        $origDueDate = $task->due_date ? substr((string) $task->due_date, 0, 10) : null;
        $origStartTime = $task->start_time !== null ? substr((string) $task->start_time, 0, 5) : null;
        $origEndTime = $task->end_time !== null ? substr((string) $task->end_time, 0, 5) : null;
        $origReminder = $task->reminder ?? 'none';
        $origRepeat = $task->repeat ?? 'never';
        $origRepeatAnchor = $task->repeat_anchor ? substr((string) $task->repeat_anchor, 0, 10) : null;

        $merged = [
            'title' => $task->title,
            'due_date' => $origDueDate,
            'start_time' => $origStartTime,
            'end_time' => $origEndTime,
            'priority' => $task->priority,
            'reminder' => $origReminder,
            'repeat' => $origRepeat,
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
                $fieldUpdatedAt[$field] = $fieldEffectiveAt->format('Y-m-d\TH:i:s\Z');
                $appliedFields[$field] = true;
            }
        }

        // 6. Dependent fields (TK §2.2)
        // - clearing due_date → start_time, end_time, reminder get due_date's time
        $dueDateWasCleared = array_key_exists('due_date', $appliedFields) && $merged['due_date'] === null;

        if ($dueDateWasCleared) {
            $dueDateEffectiveAtIso = ($effectiveAtMap['due_date'] ?? $this->resolveFieldEffectiveAt('due_date', $atPayload))->format('Y-m-d\TH:i:s\Z');
            $merged['start_time'] = null;
            $fieldUpdatedAt['start_time'] = $dueDateEffectiveAtIso;
            $merged['end_time'] = null;
            $fieldUpdatedAt['end_time'] = $dueDateEffectiveAtIso;
            $merged['reminder'] = 'none';
            $fieldUpdatedAt['reminder'] = $dueDateEffectiveAtIso;
        }

        // - clearing start_time → end_time gets start_time's time
        $startTimeWasCleared = array_key_exists('start_time', $appliedFields) && $merged['start_time'] === null;

        if ($startTimeWasCleared && ! $dueDateWasCleared) {
            $startTimeEffectiveAtIso = ($effectiveAtMap['start_time'] ?? $this->resolveFieldEffectiveAt('start_time', $atPayload))->format('Y-m-d\TH:i:s\Z');
            $merged['end_time'] = null;
            $fieldUpdatedAt['end_time'] = $startTimeEffectiveAtIso;
        }

        // - start_time set, or repeat not never, and the merged due_date is empty → due_date = $clock->today($timezone)
        if (DueDateFallback::needed(
            is_string($merged['due_date']) ? $merged['due_date'] : null,
            is_string($merged['start_time']) ? $merged['start_time'] : null,
            (string) $merged['repeat'],
        )) {
            $merged['due_date'] = $this->clock->today($timezone);
            if (array_key_exists('start_time', $effectiveAtMap)) {
                $fieldUpdatedAt['due_date'] = $effectiveAtMap['start_time']->format('Y-m-d\TH:i:s\Z');
            } elseif (array_key_exists('repeat', $effectiveAtMap)) {
                $fieldUpdatedAt['due_date'] = $effectiveAtMap['repeat']->format('Y-m-d\TH:i:s\Z');
            } else {
                $fieldUpdatedAt['due_date'] = $this->resolveEffectiveAt(null)->format('Y-m-d\TH:i:s\Z');
            }
        }

        // - repeat changes from never → repeat_anchor = due_date; repeat becomes never → repeat_anchor = null;
        //   due_date changes while repeating → keep the anchor.
        $repeatAnchor = $origRepeatAnchor;
        $newRepeat = (string) $merged['repeat'];

        if ($origRepeat === 'never' && $newRepeat !== 'never') {
            $repeatAnchor = $merged['due_date'];
        } elseif ($origRepeat !== 'never' && $newRepeat === 'never') {
            $repeatAnchor = null;
        } elseif ($origRepeat !== 'never' && $newRepeat !== 'never') {
            if ($repeatAnchor === null) {
                $repeatAnchor = $merged['due_date'];
            }
        } else {
            $repeatAnchor = null;
        }

        // 8. Validation on the merged state
        $errors = [];
        $startTime = $merged['start_time'];
        $endTime = $merged['end_time'];
        $reminder = (string) $merged['reminder'];
        $dueDate = $merged['due_date'];

        if ($endTime !== null) {
            if ($startTime === null) {
                $errors['end_time'] = ['End time cannot be set without a start time.'];
            } elseif ($endTime <= $startTime) {
                $errors['end_time'] = ['End time must be later than the start time.'];
            }
        }

        if ($reminder !== 'none' && empty($dueDate)) {
            $errors['reminder'] = ['Add a date to set a reminder.'];
        }

        if (! empty($errors)) {
            throw ValidationException::withMessages($errors);
        }

        // 9. Remind_at calculation
        $scheduleOrReminderChanged = ($merged['due_date'] !== $origDueDate
            || $merged['start_time'] !== $origStartTime
            || $merged['reminder'] !== $origReminder);

        if ($scheduleOrReminderChanged) {
            if (empty($merged['due_date']) || $merged['reminder'] === 'none') {
                $task->remind_at = null;
            } else {
                $task->remind_at = $this->reminders->compute(
                    (string) $merged['due_date'],
                    $merged['start_time'],
                    (string) $merged['reminder'],
                    $timezone,
                );
            }
        }

        // 10. Save once (if dirty)
        $task->title = (string) $merged['title'];
        $task->due_date = $merged['due_date'];
        $task->start_time = $merged['start_time'];
        $task->end_time = $merged['end_time'];
        $task->priority = $merged['priority'];
        $task->reminder = (string) $merged['reminder'];
        $task->repeat = (string) $merged['repeat'];
        $task->notes = $merged['notes'];
        $task->project_id = $merged['project_id'];
        $task->repeat_anchor = $repeatAnchor;
        $task->field_updated_at = $fieldUpdatedAt;

        if ($task->isDirty()) {
            $task->save();
        }

        return $task;
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

    public function isLaterThan(DateTimeImmutable $effectiveAt, ?string $storedAtStr): bool
    {
        if ($storedAtStr === null || $storedAtStr === '') {
            return true;
        }

        try {
            $storedAt = (new DateTimeImmutable($storedAtStr))->setTimezone(new DateTimeZone('UTC'));

            return $effectiveAt > $storedAt;
        } catch (Throwable) {
            return true;
        }
    }

    public function complete(Task $task, ?string $at): Task
    {
        if ($task->done) {
            return $task;
        }

        $effectiveAt = $this->resolveEffectiveAt($at);
        $effectiveAtIso = $effectiveAt->format('Y-m-d\TH:i:s\Z');

        /** @var array<string, string> $fieldUpdatedAt */
        $fieldUpdatedAt = $task->field_updated_at ?? [];
        $storedDoneAt = $fieldUpdatedAt['done'] ?? null;

        if ($this->isLaterThan($effectiveAt, $storedDoneAt)) {
            $task->done = true;
            $task->done_at = $effectiveAtIso;
            $fieldUpdatedAt['done'] = $effectiveAtIso;
            $task->field_updated_at = $fieldUpdatedAt;
            $task->save();
        }

        return $task;
    }

    public function reopen(Task $task, ?string $at): Task
    {
        $effectiveAt = $this->resolveEffectiveAt($at);
        $effectiveAtIso = $effectiveAt->format('Y-m-d\TH:i:s\Z');

        /** @var array<string, string> $fieldUpdatedAt */
        $fieldUpdatedAt = $task->field_updated_at ?? [];
        $storedDoneAt = $fieldUpdatedAt['done'] ?? null;

        if ($this->isLaterThan($effectiveAt, $storedDoneAt)) {
            $task->done = false;
            $task->done_at = null;
            $fieldUpdatedAt['done'] = $effectiveAtIso;
            $task->field_updated_at = $fieldUpdatedAt;
            $task->save();
        }

        return $task;
    }
}
