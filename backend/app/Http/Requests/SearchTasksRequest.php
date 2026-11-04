<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SearchTasksRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:all,open,completed'],
            'filter' => ['nullable', 'string', 'in:overdue,due_week,starts_today,high_priority,from_note'],
            'project_id' => ['nullable', 'uuid'],
            'cursor' => ['nullable', 'string', 'max:512'],
        ];
    }

    public static function validText(string $q): bool
    {
        return mb_check_encoding($q, 'UTF-8') && ! str_contains($q, "\0");
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $q = $this->input('q');
                if (is_string($q) && ! self::validText($q)) {
                    $validator->errors()->add('q', 'The search text is invalid.');
                }
            },
        ];
    }
}
