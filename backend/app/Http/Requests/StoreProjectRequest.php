<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    public const ALLOWED_COLOURS = ['blue', 'red', 'orange', 'yellow', 'green', 'teal', 'purple', 'gray'];

    public const MIN_NAME_LENGTH = 1;

    public const MAX_NAME_LENGTH = 40;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name') && is_string($this->name)) {
            $this->merge(['name' => trim($this->name)]);
        }
    }

    /**
     * @return list<string>
     */
    public static function nameRules(): array
    {
        return ['string', 'min:'.self::MIN_NAME_LENGTH, 'max:'.self::MAX_NAME_LENGTH];
    }

    /**
     * @return list<string>
     */
    public static function colourRules(): array
    {
        return ['string', 'in:'.implode(',', self::ALLOWED_COLOURS)];
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid'],
            'name' => ['required', ...self::nameRules()],
            'colour' => ['required', ...self::colourRules()],
        ];
    }
}
