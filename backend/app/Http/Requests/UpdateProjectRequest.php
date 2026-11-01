<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateProjectRequest extends FormRequest
{
    public const PATCHABLE = ['name', 'colour'];

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
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', ...StoreProjectRequest::nameRules()],
            'colour' => ['sometimes', 'required', ...StoreProjectRequest::colourRules()],
        ];
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
                    if (! in_array($strKey, self::PATCHABLE, true)) {
                        $validator->errors()->add($strKey, "This field can't be changed.");
                    }
                }
            },
        ];
    }
}
