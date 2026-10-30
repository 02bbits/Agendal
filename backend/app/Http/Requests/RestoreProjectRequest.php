<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RestoreProjectRequest extends FormRequest
{
    public const VALID_MODES = ['move', 'delete'];

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
            'task_ids' => ['present', 'array'],
            'task_ids.*' => ['uuid'],
            'mode' => ['required', 'string', 'in:'.implode(',', self::VALID_MODES)],
        ];
    }
}
