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
     * @param  array{retry_after?: int}  $extra  Merged into `error`. `retry_after` also sets the Retry-After header.
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 422,
        public readonly array $fields = [],
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        $error = ['code' => $this->errorCode, 'message' => $this->getMessage(), 'request_id' => Context::get('request_id')];
        if ($this->fields !== []) {
            $error['fields'] = $this->fields;
        }
        $headers = isset($this->extra['retry_after']) ? ['Retry-After' => (string) $this->extra['retry_after']] : [];

        return response()->json(['error' => $error + $this->extra], $this->status, $headers);
    }

    // A client error, not a fault: nothing to log
    public function report(): void {}
}
