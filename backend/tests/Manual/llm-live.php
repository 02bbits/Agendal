<?php

declare(strict_types=1);

// Explicit, bounded live experiment with synthetic notes. Never prints headers, credentials or raw errors.
// php tests/Manual/llm-live.php [--timeout=20] [--model=vendor/model:free] [--quality] [--case=calendar]
// --confidence selects routing cases; --prompt=note-plan-vN overrides the prompt only for this run.
// --languages selects English and accented Vietnamese cases, including probes for unresolved references.
// NVIDIA direct: pass --provider=nvidia --key-stdin and pipe NVIDIA_API_KEY over stdin, never as an argument.
// The array cache isolates the experiment's budget from real app users. Provider quotas still apply.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\OpenRouterFallback;
use Dotenv\Dotenv;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Client\Events\ConnectionFailed;
use Illuminate\Http\Client\Events\RequestSending;
use Illuminate\Http\Client\Events\ResponseReceived;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$options = getopt('', ['timeout:', 'model:', 'quality', 'confidence', 'languages', 'case:', 'provider:', 'key-stdin', 'show-content', 'prompt:']);
config(['cache.default' => 'array', 'note_llm.enabled' => true, 'note_llm.prompt_version' => 'note-plan-v6']);
if (isset($options['prompt'])) {
    if (! preg_match('/^note-plan-v\d+$/D', $options['prompt']) || ! is_file(resource_path('prompts/'.$options['prompt'].'.txt'))) {
        fwrite(STDERR, "Unknown live test prompt.\n");
        exit(1);
    }
    config(['note_llm.prompt_version' => $options['prompt']]);
}
$provider = $options['provider'] ?? config('note_llm.provider');
if (! in_array($provider, ['openrouter', 'nvidia'], true)) {
    fwrite(STDERR, "Unknown live test provider.\n");
    exit(1);
}
config(['note_llm.provider' => $provider]);
if ($provider === 'nvidia') {
    // Read the workspace file explicitly: an inherited Windows variable may contain an older key.
    $workspaceEnv = Dotenv::parse((string) file_get_contents(base_path('.env')));
    $key = array_key_exists('key-stdin', $options) ? trim((string) stream_get_contents(STDIN)) : (string) ($workspaceEnv['NVIDIA_API_KEY'] ?? '');
    config(['note_llm.key' => $key, 'note_llm.url' => 'https://integrate.api.nvidia.com/v1/chat/completions',
        'note_llm.model' => 'nvidia/nemotron-3.5-super-vl-120b-a12b']);
} elseif (isset($options['provider'])) {
    $workspaceEnv = Dotenv::parse((string) file_get_contents(base_path('.env')));
    config(['note_llm.key' => $workspaceEnv['OPENROUTER_API_KEY'] ?? '',
        'note_llm.url' => 'https://openrouter.ai/api/v1/chat/completions']);
}
if (isset($options['timeout'])) {
    config(['note_llm.timeout_seconds' => max(0.1, min(30, (float) $options['timeout']))]);
}
if (isset($options['model'])) {
    config(['note_llm.model' => $options['model']]);
}
if (! config('note_llm.key') || ! config('note_llm.model')) {
    fwrite(STDERR, "Configure the key and model in backend/.env first.\n");
    exit(1);
}
$http = [];
$sentAt = null;
Event::listen(RequestSending::class, function () use (&$sentAt): void {
    $sentAt = hrtime(true);
});
Event::listen(ResponseReceived::class, function (ResponseReceived $event) use (&$http, &$sentAt, $options): void {
    $http[] = ['status' => $event->response->status(), 'tokens' => $event->response->json('usage.total_tokens'),
        'model' => $event->response->json('model'),
        'elapsed_ms' => $sentAt === null ? null : round((hrtime(true) - $sentAt) / 1e6),
        'completion_tokens' => $event->response->json('usage.completion_tokens'),
        'finish_reason' => $event->response->json('choices.0.finish_reason'),
        'error_code' => $event->response->json('error.code'),
        'provider' => $event->response->json('error.metadata.provider_name'),
        'limit_source' => $event->response->json('error.metadata.limit_source'),
        ...(array_key_exists('show-content', $options) ? ['content' => $event->response->json('choices.0.message.content')] : [])];
});
Event::listen(ConnectionFailed::class, function () use (&$http, &$sentAt): void {
    $http[] = ['status' => 'connection_failed_or_timeout', 'elapsed_ms' => $sentAt === null ? null : round((hrtime(true) - $sentAt) / 1e6)];
});
$context = new NoteContext(new DateTimeImmutable('2026-11-02T08:00:00+07:00'), 'Asia/Ho_Chi_Minh');
$task = ['id' => 'a0000000-0000-4000-8000-000000000001', 'title' => 'Call mum', 'due_date' => '2026-11-09'];
$cases = [
    ['id' => 'confident', 'text' => 'call dad tomorrow', 'tasks' => []],
    ['id' => 'no_change', 'text' => 'move call mum to monday', 'tasks' => [$task]],
    ['id' => 'vietnamese', 'text' => 'toi can mua sua', 'tasks' => []],
];
if (array_key_exists('quality', $options) || array_key_exists('confidence', $options) || array_key_exists('languages', $options) || isset($options['case'])) {
    $cases[] = ['id' => 'calendar', 'text' => 'toi can tap gym moi thu hai va thu tu luc 9 gio sang', 'tasks' => []];
    $cases[] = ['id' => 'copies', 'text' => 'toi can uong nuoc 3 lan moi ngay', 'tasks' => []];
    $cases[] = ['id' => 'command_confirm', 'text' => 'delete mum phone', 'tasks' => [$task]];
    $cases[] = ['id' => 'unaccented_delete', 'text' => 'xoa call mum', 'tasks' => [$task]];
    $cases[] = ['id' => 'unaccented_move', 'text' => 'doi call mum sang thu tu', 'tasks' => [$task]];
    $cases[] = ['id' => 'unknown_with_time', 'text' => 'hop team 9h', 'tasks' => []];
    $cases[] = ['id' => 'typo_delete', 'text' => 'xoaa call mum', 'tasks' => [$task]];
    $cases[] = ['id' => 'mixed_targets', 'text' => 'delete mum and absent', 'tasks' => [$task]];
    $cases[] = ['id' => 'holdout_delete', 'text' => 'bo dum task call mum di', 'tasks' => [$task]];
    $cases[] = ['id' => 'holdout_move', 'text' => 'chuyen lich call mum qua thu 4 nha', 'tasks' => [$task]];
    $cases[] = ['id' => 'en_delete', 'text' => 'could you remove the Call mum task please', 'tasks' => [$task]];
    $cases[] = ['id' => 'en_move', 'text' => 'could you push my Call mum task back to Wednesday please', 'tasks' => [$task]];
    $cases[] = ['id' => 'en_create', 'text' => 'would you remind me to buy milk tomorrow at 9am', 'tasks' => []];
    $cases[] = ['id' => 'vi_delete', 'text' => 'Bạn bỏ giúp mình task Call mum nhé', 'tasks' => [$task]];
    $cases[] = ['id' => 'vi_move', 'text' => 'Bạn chuyển lịch Call mum qua thứ tư giúp mình nhé', 'tasks' => [$task]];
    $cases[] = ['id' => 'vi_create', 'text' => 'Bạn giúp mình ghé siêu thị mua sữa sáng mai lúc 9h nhé', 'tasks' => []];
    $cases[] = ['id' => 'vi_supported_create', 'text' => 'Sáng mai nhớ ghé siêu thị mua sữa lúc 9h nhé', 'tasks' => []];
    $cases[] = ['id' => 'en_vague', 'text' => 'do that thing whenever', 'tasks' => []];
    $cases[] = ['id' => 'vi_vague', 'text' => 'làm cái đó lúc nào cũng được', 'tasks' => []];
}
if (array_key_exists('languages', $options)) {
    $cases = array_values(array_filter($cases, fn (array $case): bool => str_starts_with($case['id'], 'en_') || str_starts_with($case['id'], 'vi_')));
}
if (array_key_exists('confidence', $options)) {
    $cases = array_values(array_filter($cases, fn (array $case): bool => ! in_array($case['id'], ['calendar', 'copies', 'command_confirm'], true)));
}
if (isset($options['case'])) {
    $cases = array_values(array_filter($cases, fn (array $case): bool => $case['id'] === $options['case']));
    if ($cases === []) {
        fwrite(STDERR, "Unknown live test case.\n");
        exit(1);
    }
}
echo json_encode(['provider' => $provider, 'model' => config('note_llm.model'), 'timeout_seconds' => config('note_llm.timeout_seconds'),
    'prompt_version' => config('note_llm.prompt_version'), 'reasoning_enabled' => config('note_llm.reasoning_enabled')], JSON_THROW_ON_ERROR).PHP_EOL;
$failed = 0;
foreach ($cases as $case) {
    Cache::flush();
    $http = [];
    $start = hrtime(true);
    $rules = app(NoteEngine::class)->build($case['text'], $context, $case['tasks']);
    $result = app(OpenRouterFallback::class)->improve($rules, $case['text'], $context, $case['tasks'], 1);
    echo json_encode(['case' => $case['id'], 'elapsed_ms' => round((hrtime(true) - $start) / 1e6),
        'engine' => $result->engine->value, 'status' => $result->status->value, 'http' => $http,
        'low_confidence' => $rules->lowConfidence,
        'create' => $result->plan['create'], 'update' => $result->plan['update'], 'delete' => $result->plan['delete'], 'skipped' => $result->plan['skipped']],
        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE).PHP_EOL;
    if ($http !== [] && $result->engine->value === 'rules_fallback') {
        $failed++;
        if ($failed >= 2) {
            echo "Stopped after two provider failures; no automatic retry loop.\n";
            break;
        }
    }
}
exit($failed > 0 ? 2 : 0);
