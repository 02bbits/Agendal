<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
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
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid'],
            'title' => ['required', 'string', 'min:1', 'max:200'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'priority' => ['nullable', 'in:low,medium,high'],
            'reminder' => ['nullable', 'in:none,5m,15m,30m,1h,1d'],
            'repeat' => ['nullable', 'in:never,daily,weekly,monthly,yearly'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'project_id' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $startTime = $this->input('start_time');
                $endTime = $this->input('end_time');
                $reminder = $this->input('reminder', 'none') ?? 'none';
                $dueDate = $this->input('due_date');

                if (! $validator->errors()->has('start_time') && ! $validator->errors()->has('end_time')) {
                    if ($endTime !== null) {
                        if ($startTime === null) {
                            $validator->errors()->add('end_time', 'End time cannot be set without a start time.');
                        } elseif ($endTime <= $startTime) {
                            $validator->errors()->add('end_time', 'End time must be later than the start time.');
                        }
                    }
                }

                if (! $validator->errors()->has('reminder') && $reminder !== 'none' && empty($dueDate)) {
                    $validator->errors()->add('reminder', 'Add a date to set a reminder.');
                }
            },
        ];
    }
}
