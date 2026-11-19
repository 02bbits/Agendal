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

    /** @return array<string, array{name: string, url: string, models_url: string, key_url: string, models: string, check_url?: string}> */
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
        try {
            if (isset($config['check_url'])) {
                Http::withToken($key)->timeout(self::CHECK_TIMEOUT)->get($config['check_url'])->throw();
            }
            $listed = Http::withToken($key)->timeout(self::CHECK_TIMEOUT)->get($config['models_url'])->throw()->json('data');
        } catch (RequestException $exception) {
            throw ValidationException::withMessages(['key' => [$exception->response->status() === 429 ? 'ai.key_limited' : 'ai.key_invalid']]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['key' => ['ai.key_unreachable']]);
        }
        // Gemini lists "models/gemini-…"; its chat endpoint takes the bare name.
        $ids = array_map(fn (mixed $model): string => (string) preg_replace('~^models/~', '', (string) ($model['id'] ?? '')), is_array($listed) ? $listed : []);
        $models = array_values(array_unique(array_filter($ids, fn (string $id): bool => $id !== '' && preg_match($config['models'], $id) === 1)));
        if ($models === []) {
            throw ValidationException::withMessages(['key' => ['ai.key_no_models']]);
        }
        sort($models);

        return $models;
    }
}
