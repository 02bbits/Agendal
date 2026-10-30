<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Task;
use DateTimeImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use Throwable;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('title') && is_string($this->title)) {
            $this->merge(['title' => trim($this->title)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [];
        foreach (StoreTaskRequest::fieldRules() as $field => $fieldRule) {
            $rules[$field] = ['sometimes', ...$fieldRule];
        }

        return $rules;
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $payload = $this->isJson() ? (array) $this->json()->all() : $this->all();
                foreach (array_keys($payload) as $key) {
                    $strKey = (string) $key;
                    if (! in_array($strKey, [...Task::PATCHABLE, 'at'], true)) {
                        $validator->errors()->add($strKey, "This field can't be changed.");
                    }
                }

                if (array_key_exists('at', $payload)) {
                    $at = $payload['at'];
                    if (is_array($at)) {
                        foreach ($at as $fieldKey => $val) {
                            $strFieldKey = (string) $fieldKey;
                            if (! in_array($strFieldKey, Task::PATCHABLE, true)) {
                                $validator->errors()->add("at.{$strFieldKey}", "This field can't be changed.");
                            } elseif (! array_key_exists($strFieldKey, $payload)) {
                                $validator->errors()->add("at.{$strFieldKey}", 'There is no change for this field.');
                            } elseif (! is_string($val) || preg_match(TaskLifecycleRequest::ISO_WITH_OFFSET, $val) !== 1) {
                                $validator->errors()->add("at.{$strFieldKey}", 'The at field must be a valid ISO 8601 date-time.');
                            } else {
                                try {
                                    new DateTimeImmutable($val);
                                } catch (Throwable) {
                                    $validator->errors()->add("at.{$strFieldKey}", 'The at field must be a valid ISO 8601 date-time.');
                                }
                            }
                        }
                    } elseif (is_string($at)) {
                        if (preg_match(TaskLifecycleRequest::ISO_WITH_OFFSET, $at) !== 1) {
                            $validator->errors()->add('at', 'The at field must be a valid ISO 8601 date-time.');
                        } else {
                            try {
                                new DateTimeImmutable($at);
                            } catch (Throwable) {
                                $validator->errors()->add('at', 'The at field must be a valid ISO 8601 date-time.');
                            }
                        }
                    } else {
                        $validator->errors()->add('at', 'The at field must be a valid ISO 8601 date-time.');
                    }
                }
            },
        ];
    }
}
