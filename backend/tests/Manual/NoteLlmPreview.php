<?php

declare(strict_types=1);

namespace Tests\Manual;

use App\Services\Notes\NoteBuild;
use App\Services\Notes\NoteContext;
use App\Services\Notes\OpenRouterFallback;
use Dotenv\Dotenv;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\Events\ConnectionFailed;
use Illuminate\Http\Client\Events\RequestSending;
use Illuminate\Http\Client\Events\ResponseReceived;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use Psr\Http\Message\RequestInterface;

/** Local preview transport only: the production fallback still owns schema, routing and validation. */
final class NoteLlmPreview
{
    /** @param array<string, mixed> $settings */
    public function __construct(private array $settings) {}

    public static function fromEnvironment(): self
    {
        // Explicitly read the workspace file, avoiding an inherited, outdated Windows NVIDIA key.
        return new self(Dotenv::parse((string) file_get_contents(base_path('.env'))));
    }

    /** @return array<string, array{label: string, provider: string, model: string, configured: bool}> */
    public function profiles(): array
    {
        $nvidia = ! empty($this->settings['NVIDIA_API_KEY']);
        $openrouter = ! empty($this->settings['OPENROUTER_API_KEY']);

        return [
            'nvidia_super' => ['label' => 'NVIDIA · Nemotron Super', 'provider' => 'nvidia',
                'model' => 'nvidia/nemotron-3.5-super-vl-120b-a12b', 'configured' => $nvidia],
            'nvidia_lightning' => ['label' => 'NVIDIA · Nemotron Lightning', 'provider' => 'nvidia',
                'model' => 'nvidia/nemotron-3.5-lightning-30b-a3b', 'configured' => $nvidia],
            'openrouter' => ['label' => 'OpenRouter · configured model', 'provider' => 'openrouter',
                'model' => (string) ($this->settings['NOTE_LLM_MODEL'] ?? ''), 'configured' => $openrouter],
            'openrouter_custom' => ['label' => 'OpenRouter · custom model', 'provider' => 'openrouter',
                'model' => '', 'configured' => $openrouter],
        ];
    }

    /**
     * Call once per page submission. Array cache separates test budgets from real users; provider quotas apply.
     *
     * @param  list<array<string, mixed>>  $tasks
     * @return array{build: NoteBuild, http: list<array<string, mixed>>, provider: string, model: string}
     */
    public function run(NoteBuild $rules, string $text, NoteContext $context, array $tasks, string $profile, string $customModel = '', float $timeout = 20): array
    {
        $selected = $this->profiles()[$profile] ?? throw new InvalidArgumentException('Choose a listed model profile.');
        $model = $profile === 'openrouter_custom' ? trim($customModel) : $selected['model'];
        if ($rules->lowConfidence === []) {
            return ['build' => $rules, 'http' => [], 'provider' => $selected['provider'], 'model' => $model];
        }
        if (! $selected['configured']) {
            throw new InvalidArgumentException('The selected provider has no key in backend/.env.');
        }
        if (preg_match('~^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$~D', $model) !== 1) {
            throw new InvalidArgumentException('Enter a valid model ID for the selected provider.');
        }
        $native = $selected['provider'] === 'nvidia';
        config(['cache.default' => 'array', 'note_llm.enabled' => true, 'note_llm.model' => $model,
            'note_llm.prompt_version' => 'note-plan-v6', 'note_llm.reasoning_enabled' => false,
            'note_llm.timeout_seconds' => max(1, min(30, $timeout)),
            'note_llm.url' => $native ? 'https://integrate.api.nvidia.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions',
            'note_llm.key' => $this->settings[$native ? 'NVIDIA_API_KEY' : 'OPENROUTER_API_KEY'],
        ]);
        if ($native) {
            Http::globalRequestMiddleware(self::nativeRequest(...));
        }
        $http = [];
        $sentAt = null;
        Event::listen(RequestSending::class, function () use (&$sentAt): void {
            $sentAt = hrtime(true);
        });
        Event::listen(ResponseReceived::class, function (ResponseReceived $event) use (&$http, &$sentAt): void {
            $http[] = ['status' => $event->response->status(),
                'elapsed_ms' => $sentAt === null ? null : round((hrtime(true) - $sentAt) / 1e6),
                'tokens' => $event->response->json('usage.total_tokens'),
                'model' => $event->response->json('model'),
                'content' => $event->response->json('choices.0.message.content')];
        });
        Event::listen(ConnectionFailed::class, function () use (&$http, &$sentAt): void {
            $http[] = ['status' => 'connection_failed_or_timeout',
                'elapsed_ms' => $sentAt === null ? null : round((hrtime(true) - $sentAt) / 1e6)];
        });
        $build = app(OpenRouterFallback::class)->improve($rules, $text, $context, $tasks, 0);

        return ['build' => $build, 'http' => $http, 'provider' => $selected['provider'], 'model' => $model];
    }

    public static function nativeRequest(RequestInterface $request): RequestInterface
    {
        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        unset($body['provider'], $body['reasoning']);
        $body['chat_template_kwargs'] = ['enable_thinking' => false];
        $body['stream'] = false;
        $json = json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

        return $request->withBody(Utils::streamFor($json))->withHeader('Content-Length', (string) strlen($json));
    }
}
