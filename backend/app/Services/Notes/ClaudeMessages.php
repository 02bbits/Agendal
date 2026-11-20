<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\RateLimitException;
use Anthropic\Messages\TextBlock;
use Anthropic\RequestOptions;
use GuzzleHttp\Client as Guzzle;
use Illuminate\Validation\ValidationException;
use UnexpectedValueException;

/**
 * Claude through the official Anthropic SDK (Messages API with structured outputs), for users who add a Claude key
 * in Settings › AI. The other providers speak the OpenAI chat format over plain HTTP; Claude does not.
 */
class ClaudeMessages
{
    /** Room for adaptive thinking before the JSON answer; thinking counts toward max_tokens. */
    private const MAX_TOKENS = 8000;

    /**
     * Model ids the key can use, newest first as the API lists them; a refused, limited or unreachable key is a 422.
     *
     * @return list<string>
     */
    public function models(string $key, float $timeout): array
    {
        return $this->asSettingsError('key', function () use ($key, $timeout): array {
            $ids = [];
            foreach ($this->client($key, $timeout)->models->list(limit: 100)->pagingEachItem() as $model) {
                $ids[] = $model->id;
            }

            return $ids;
        });
    }

    /** A one-token request, since a listed model may still refuse this key. */
    public function tryModel(string $key, string $model, float $timeout): void
    {
        $this->asSettingsError('model', fn () => $this->client($key, $timeout)->messages->create(
            model: $model, maxTokens: 16, messages: [['role' => 'user', 'content' => 'ok']],
        ));
    }

    /**
     * One note plan: the JSON text Claude wrote against $schema and the tokens it used. A refusal or an answer with
     * no text throws, so the rules result stands. SDK errors (status, connection, timeout) also bubble up to the
     * fallback, which records them as rules_fallback.
     *
     * @param  array<string, mixed>  $schema
     * @return array{content: string, tokens: int}
     */
    public function plan(string $key, string $model, string $system, string $user, array $schema, float $timeout): array
    {
        $message = $this->client($key, $timeout)->messages->create(
            model: $model,
            maxTokens: self::MAX_TOKENS,
            system: $system,
            messages: [['role' => 'user', 'content' => $user]],
            // Reading a few note items is extraction work: low effort keeps it quick.
            outputConfig: ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
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

    /** The SDK leaves the timeout to its HTTP transport, so it gets a Guzzle client with one. */
    private function client(string $key, float $timeout): Client
    {
        return new Client(apiKey: $key, requestOptions: RequestOptions::with(
            maxRetries: 1, transporter: new Guzzle(['timeout' => $timeout, 'connect_timeout' => $timeout]),
        ));
    }

    /**
     * @template T
     *
     * @param  callable(): T  $call
     * @return T
     */
    private function asSettingsError(string $field, callable $call): mixed
    {
        try {
            return $call();
        } catch (RateLimitException) {
            throw ValidationException::withMessages([$field => ['ai.key_limited']]);
        } catch (APIStatusException) {
            throw ValidationException::withMessages([$field => [$field === 'key' ? 'ai.key_invalid' : 'ai.model_unavailable']]);
        } catch (APIConnectionException) {
            throw ValidationException::withMessages([$field => ['ai.key_unreachable']]);
        }
    }
}
