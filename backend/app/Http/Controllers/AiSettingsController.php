<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Notes\LlmProviders;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Settings › AI: the AI switch, the user's provider keys and the model unclear notes use. A key is checked with its
 * provider before it is kept, stored encrypted, and only its last four characters ever come back.
 */
class AiSettingsController extends Controller
{
    public function __construct(private LlmProviders $providers) {}

    /** @return array<string, mixed> */
    public function show(Request $request): array
    {
        return $this->settings($this->user($request));
    }

    /** @return array<string, mixed> */
    public function update(Request $request): array
    {
        $user = $this->user($request);
        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'model' => ['sometimes', 'string', Rule::in($this->choices($user))],
        ]);
        $user->forceFill([
            'llm_enabled' => $data['enabled'] ?? $user->llm_enabled,
            'llm_model' => $data['model'] ?? $user->llm_model,
        ])->save();

        return $this->settings($user);
    }

    /** @return array<string, mixed> */
    public function saveKey(Request $request, string $provider): array
    {
        abort_unless(array_key_exists($provider, $this->providers->all()), 404);
        $key = trim((string) $request->validate(['key' => ['required', 'string', 'max:500']])['key']);
        $models = $this->providers->models($provider, $key);
        $user = $this->user($request);
        $keys = [...($user->llm_keys ?? []), $provider => ['key' => $key, 'models' => $models]];
        $user->forceFill(['llm_keys' => $keys])->save();
        // The first key also picks the model, so it is used straight away.
        if (! in_array($user->llm_model, $this->choices($user), true)) {
            $user->forceFill(['llm_model' => $provider.':'.$models[0]])->save();
        }

        return $this->settings($user);
    }

    public function removeKey(Request $request, string $provider): Response
    {
        $user = $this->user($request);
        $keys = $user->llm_keys ?? [];
        unset($keys[$provider]);
        $user->forceFill(['llm_keys' => $keys === [] ? null : $keys])->save();
        // A model of the removed key moves to the first one another key has, or to none.
        if (! in_array($user->llm_model, $this->choices($user), true)) {
            $user->forceFill(['llm_model' => $this->choices($user)[0] ?? null])->save();
        }

        return response()->noContent();
    }

    /** @return array<string, mixed> */
    private function settings(User $user): array
    {
        $keys = $user->llm_keys ?? [];

        return [
            'enabled' => $user->llm_enabled,
            'model' => $user->llm_model,
            'providers' => array_map(fn (string $id, array $provider): array => [
                'id' => $id,
                'name' => $provider['name'],
                'key_url' => $provider['key_url'],
                'last4' => isset($keys[$id]) ? substr($keys[$id]['key'], -4) : null,
                'models' => $keys[$id]['models'] ?? [],
            ], array_keys($this->providers->all()), $this->providers->all()),
        ];
    }

    /**
     * "provider:model" for every model the user's keys can use.
     *
     * @return list<string>
     */
    private function choices(User $user): array
    {
        $choices = [];
        foreach ($user->llm_keys ?? [] as $provider => $key) {
            if (array_key_exists($provider, $this->providers->all())) {
                foreach ($key['models'] as $model) {
                    $choices[] = $provider.':'.$model;
                }
            }
        }

        return $choices;
    }

    private function user(Request $request): User
    {
        /** @var User */
        return $request->user();
    }
}
