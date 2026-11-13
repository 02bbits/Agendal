<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\Reminder;
use App\Services\Tasks\DueDateFallback;
use App\Services\Tasks\RepeatSchedule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merges = [];
        if ($this->has('title') && is_string($this->title)) {
            $merges['title'] = trim($this->title);
        }
        if (! $this->has('reminder') || $this->input('reminder') === null) {
            $merges['reminder'] = 'none';
        }
        if (! $this->has('repeat') || $this->input('repeat') === null) {
            $merges['repeat'] = 'never';
        }
        if (! empty($merges)) {
            $this->merge($merges);
        }
    }

    /**
     * @return array<string, list<mixed>>
     */
    public static function fieldRules(): array
    {
        return [
            'title' => ['required', 'string', 'min:1', 'max:200'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'due_time' => ['nullable', 'date_format:H:i'],
            'priority' => ['nullable', 'in:low,medium,high'],
            'reminder' => ['nullable', Rule::enum(Reminder::class)],
            'repeat' => ['nullable', 'in:never,daily,weekly,monthly,yearly'],
            'repeat_rule' => ['nullable', 'string', 'max:300'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'project_id' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid'],
            ...self::fieldRules(),
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $startDate = $this->input('start_date');
                $dueDate = $this->input('due_date');
                $dueTime = $this->input('due_time');
                $reminder = $this->input('reminder', 'none') ?? 'none';
                $repeat = $this->input('repeat', 'never') ?? 'never';

                $startDateStr = is_string($startDate) ? $startDate : null;
                $dueDateStr = is_string($dueDate) ? $dueDate : null;
                $dueTimeStr = is_string($dueTime) ? $dueTime : null;
                $repeatStr = is_string($repeat) ? $repeat : 'never';

                $startTime = $this->input('start_time');
                $timeErrors = DueDateFallback::timeErrors($startDateStr, is_string($startTime) ? $startTime : null, $dueDateStr, $dueTimeStr);
                foreach ($timeErrors as $field => $messages) {
                    if (! $validator->errors()->has($field)) {
                        $validator->errors()->add($field, $messages[0]);
                    }
                }

                $rule = $this->input('repeat_rule');
                if (is_string($rule) && ! RepeatSchedule::validFor($rule, $repeatStr)) {
                    $validator->errors()->add('repeat_rule', 'The repeat rule must match the repeat frequency.');
                }

                if (! $validator->errors()->has('reminder') && $reminder !== 'none' && empty($startDate) && empty($dueDate)) {
                    if (! DueDateFallback::needed($dueDateStr, $startDateStr, $repeatStr)) {
                        $validator->errors()->add('reminder', 'Add a date to set a reminder.');
                    }
                }
            },
        ];
    }
}
