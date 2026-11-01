<?php

declare(strict_types=1);

namespace App\Http\Requests;

use DateTimeImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use Throwable;

class TaskLifecycleRequest extends FormRequest
{
    public const ISO_WITH_OFFSET = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->has('at')) {
                    $at = $this->input('at');
                    if (! is_string($at) || preg_match(self::ISO_WITH_OFFSET, $at) !== 1) {
                        $validator->errors()->add('at', 'The at field must be a valid ISO 8601 date-time.');
                    } else {
                        try {
                            new DateTimeImmutable($at);
                        } catch (Throwable) {
                            $validator->errors()->add('at', 'The at field must be a valid ISO 8601 date-time.');
                        }
                    }
                }
            },
        ];
    }
}
