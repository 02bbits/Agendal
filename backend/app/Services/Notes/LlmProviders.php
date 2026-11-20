<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/** The providers in config('note_llm.providers') and the models a user's key can use there (Settings › AI). */
final class LlmProviders
{
    /** Seconds a key check may take; it runs while the user waits on Save. */
    private const CHECK_TIMEOUT = 10;

    public function __construct(private ClaudeMessages $claude) {}

    /** @return array<string, array{name: string, key_url: string, models: string, default: string, sdk?: string, url?: string, models_url?: string, check_url?: string}> */
    public function all(): array
    {
        return config('note_llm.providers');
    }

    /**
     * Asks the provider with $key and keeps the models that can plan a note. A key the provider refuses, one out of
     * quota, an unreachable provider or no usable model is a 422 on `key`, so nothing is saved.
     *
     * @return list<string>
     */
    public function models(string $provider, string $key): array
    {
        $config = $this->all()[$provider];
        if (($config['sdk'] ?? null) === 'anthropic') {
            $models = $this->usable($provider, $this->claude->models($key, self::CHECK_TIMEOUT));

            return $models === [] ? throw ValidationException::withMessages(['key' => ['ai.key_no_models']]) : $models;
        }
        try {
            if (isset($config['check_url'])) {
                Http::withToken($key)->timeout(self::CHECK_TIMEOUT)->get($config['check_url'])->throw();
            }
            $listed = Http::withToken($key)->timeout(self::CHECK_TIMEOUT)->get((string) ($config['models_url'] ?? ''))->throw()->json('data');
        } catch (RequestException $exception) {
            throw ValidationException::withMessages(['key' => [$exception->response->status() === 429 ? 'ai.key_limited' : 'ai.key_invalid']]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['key' => ['ai.key_unreachable']]);
        }
        // Gemini lists "models/gemini-…"; its chat endpoint takes the bare name.
        $ids = array_map(fn (mixed $model): string => (string) preg_replace('~^models/~', '', (string) ($model['id'] ?? '')), is_array($listed) ? $listed : []);
        $models = $this->usable($provider, array_unique($ids));
        if ($models === []) {
            throw ValidationException::withMessages(['key' => ['ai.key_no_models']]);
        }

        return $models;
    }

    /**
     * A one-token request to $model, since a provider may still list a model it no longer serves. An unknown or
     * retired model is a 422 on `model`; a key out of quota or an unreachable provider says so.
     */
    public function tryModel(string $provider, string $key, string $model): void
    {
        if (($this->all()[$provider]['sdk'] ?? null) === 'anthropic') {
            $this->claude->tryModel($key, $model, self::CHECK_TIMEOUT);

            return;
        }
        try {
            Http::withToken($key)->timeout(self::CHECK_TIMEOUT)->post((string) ($this->all()[$provider]['url'] ?? ''), [
                'model' => $model, 'max_tokens' => 1, 'messages' => [['role' => 'user', 'content' => 'ok']],
            ])->throw();
        } catch (RequestException $exception) {
            throw ValidationException::withMessages(['model' => [$exception->response->status() === 429 ? 'ai.key_limited' : 'ai.model_unavailable']]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['model' => ['ai.key_unreachable']]);
        }
    }

    /**
     * The models of a provider that can plan a note, by the current config, so a saved key's list follows it too.
     *
     * @param  iterable<string>  $models
     * @return list<string>
     */
    public function usable(string $provider, iterable $models): array
    {
        $pattern = $this->all()[$provider]['models'] ?? null;
        $kept = $pattern === null ? [] : array_values(array_filter([...$models], fn (string $id): bool => $id !== '' && preg_match($pattern, $id) === 1));
        sort($kept);

        return $kept;
    }

    /**
     * The model a new key starts with: the provider's default when the key can use it, else its first usable one.
     *
     * @param  list<string>  $usable
     */
    public function pick(string $provider, array $usable): ?string
    {
        $default = $this->all()[$provider]['default'] ?? null;

        return in_array($default, $usable, true) ? $default : ($usable[0] ?? null);
    }
}
