<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Anthropic\Client;
use Anthropic\Messages\TextBlock;
use Anthropic\RequestOptions;
use GuzzleHttp\Client as Guzzle;
use SensitiveParameter;
use UnexpectedValueException;

/**
 * Claude through the official Anthropic SDK (Messages API with structured outputs), when the app's provider is
 * anthropic. The other providers speak the OpenAI chat format over plain HTTP; Claude does not.
 */
class ClaudeMessages
{
    /** Room for adaptive thinking before the JSON answer; thinking counts toward max_tokens. */
    private const MAX_TOKENS = 8000;

    /**
     * One note plan: the JSON text Claude wrote against $schema and the tokens it used. A refusal or an answer with
     * no text throws, so the rules result stands. SDK errors (status, connection, timeout) also bubble up to the
     * fallback, which records them as rules_fallback.
     *
     * @param  array<string, mixed>  $schema
     * @return array{content: string, tokens: int}
     */
    public function plan(#[SensitiveParameter] string $key, string $model, string $system, string $user, array $schema, float $timeout): array
    {
        $message = $this->client($key, $timeout)->messages->create(
            model: $model,
            maxTokens: self::MAX_TOKENS,
            system: $system,
            messages: [['role' => 'user', 'content' => $user]],
            // Reading a few note items is extraction work: low effort keeps it quick.
            outputConfig: ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => self::nullableEnums($schema)]],
        );
        if ($message->stopReason === 'refusal') {
            throw new UnexpectedValueException('Claude declined the note');
        }
        foreach ($message->content as $block) {
            if ($block instanceof TextBlock) {
                return ['content' => $block->text, 'tokens' => $message->usage->inputTokens + $message->usage->outputTokens];
            }
        }
        throw new UnexpectedValueException('Claude answered without text');
    }

    /**
     * Claude refuses an enum holding null under a type list ("Enum value None does not match declared type"), so
     * {type: [X, null], enum: [null, …]} becomes anyOf [{type: X, enum: […]}, {type: null}]; proposals() still
     * checks the answer against the original schema.
     *
     * @param  array<array-key, mixed>  $schema
     * @return array<array-key, mixed>
     */
    public static function nullableEnums(array $schema): array
    {
        $schema = array_map(fn (mixed $value): mixed => is_array($value) ? self::nullableEnums($value) : $value, $schema);
        if (! isset($schema['enum']) || ! is_array($schema['type'] ?? null) || ! in_array(null, $schema['enum'], true)) {
            return $schema;
        }
        $values = array_values(array_filter($schema['enum'], fn (mixed $value): bool => $value !== null));
        $type = array_values(array_diff($schema['type'], ['null']))[0] ?? 'string';
        $rest = array_diff_key($schema, ['type' => 1, 'enum' => 1]);

        return [...$rest, 'anyOf' => $values === [] ? [['type' => 'null']] : [['type' => $type, 'enum' => $values], ['type' => 'null']]];
    }

    /** The SDK leaves the timeout to its HTTP transport, so it gets a Guzzle client with one. */
    private function client(#[SensitiveParameter] string $key, float $timeout): Client
    {
        return new Client(apiKey: $key, requestOptions: RequestOptions::with(
            maxRetries: 1, transporter: new Guzzle(['timeout' => $timeout, 'connect_timeout' => $timeout]),
        ));
    }
}
