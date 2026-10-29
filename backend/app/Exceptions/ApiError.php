<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Context;

// An expected error with its own copy-catalog code, in the API error shape (api.md conventions)
class ApiError extends Exception
{
    /**
     * @param  array<string, array<string>>  $fields
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 422,
        public readonly array $fields = [],
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        $error = ['code' => $this->errorCode, 'message' => $this->getMessage(), 'request_id' => Context::get('request_id')];
        if ($this->fields !== []) {
            $error['fields'] = $this->fields;
        }

        return response()->json(['error' => $error], $this->status);
    }

    // A client error, not a fault: nothing to log
    public function report(): void {}
}
