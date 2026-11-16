<?php

/*
 * Try notes in the browser: the whole note engine (split, classify, extract, match, validate, status, name), with
 * no database. From backend/ run
 *   php -S localhost:8090 tests/Manual/try.php
 * and open http://localhost:8090. Tasks use the notes.txt lines: "task: Title | 2026-10-26 | 09:00-10:00",
 * "done: Title". A dev tool only: it lives in tests/, so it is never deployed.
 */

declare(strict_types=1);

use App\Enums\WeekStart;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteSplitter;
use App\Services\Tasks\RepeatSchedule;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\Manual\NoteLlmPreview;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

session_name('agendal_note_preview');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$preview = NoteLlmPreview::fromEnvironment();
$profiles = $preview->profiles();

$form = [
    'note' => (string) ($_POST['note'] ?? "sql quiz monday 9am, done call mum\npush email the group back 1 hour\ndelete old list"),
    'tasks' => (string) ($_POST['tasks'] ?? "task: Call mum\ntask: Email the group | 2026-10-23 | 09:00-10:00\ntask: Old list\ndone: Pay rent"),
    'now' => (string) ($_POST['now'] ?? (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d\TH:i')),
    'timezone' => (string) ($_POST['timezone'] ?? 'Asia/Ho_Chi_Minh'),
    'week' => (string) ($_POST['week'] ?? 'mon'),
    'mode' => (string) ($_POST['mode'] ?? ($_SERVER['REQUEST_METHOD'] === 'GET' ? 'llm' : 'rules')),
    'profile' => (string) ($_POST['profile'] ?? ($profiles['nvidia_super']['configured'] ? 'nvidia_super' : 'openrouter')),
    'custom_model' => (string) ($_POST['custom_model'] ?? ''),
    'timeout' => max(1, min(30, (float) ($_POST['timeout'] ?? 20))),
];
$e = fn (mixed $value): string => htmlspecialchars(is_string($value) ? $value : (string) json_encode($value, JSON_UNESCAPED_UNICODE), ENT_QUOTES);

$result = null;
$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (! is_string($_POST['csrf'] ?? null) || ! hash_equals($_SESSION['csrf'], $_POST['csrf'])) {
            throw new InvalidArgumentException('This form expired. Reload the page and try again.');
        }
        [$open, $done] = [[], []];
        foreach (preg_split('~\R~', $form['tasks']) ?: [] as $line) {
            if (preg_match('~^\s*(task|done):\s*(.+)$~', $line, $m) !== 1) {
                continue;
            }
            [$title, $date, $times] = array_pad(array_map(trim(...), explode('|', $m[2])), 3, '');
            [$start, $end] = array_pad(explode('-', $times), 2, null);
            $row = ['id' => (string) Str::uuid(), 'title' => $title, 'due_date' => $date ?: null, 'start_time' => $start ?: null, 'end_time' => $end ?: null, 'done' => $m[1] === 'done'];
            $m[1] === 'task' ? $open[] = $row : $done[] = $row;
        }
        $zone = new DateTimeZone($form['timezone']);
        $context = new NoteContext(new DateTimeImmutable($form['now'], $zone), $form['timezone'], weekStart: WeekStart::from($form['week']));
        $text = app(NoteSplitter::class)->normalize($form['note']);
        // A wide budget, so a slow first run still shows what the rules make; the time it took is shown against
        // the real budget, past which POST /notes makes the rest of the items plain tasks (SEC-23).
        $started = hrtime(true);
        $build = app(NoteEngine::class)->build($text, $context, $open, $done, budgetMs: 60_000.0);
        $rules = $build;
        $rulesMs = (hrtime(true) - $started) / 1e6;
        $llm = null;
        if ($form['mode'] === 'llm') {
            $llm = $preview->run($rules, $text, $context, $open, $form['profile'], $form['custom_model'], $form['timeout']);
            $build = $llm['build'];
        }
        $result = [
            'build' => $build,
            'rules' => $rules,
            'rules_ms' => $rulesMs,
            'llm' => $llm,
            'ms' => (hrtime(true) - $started) / 1e6,
            'items' => app(NoteSplitter::class)->split($text),
            'titles' => array_column([...$open, ...$done], 'title', 'id'),
        ];
    } catch (Throwable $exception) {
        $error = $exception instanceof ValidationException
            ? implode(', ', array_merge(...array_values($exception->errors())))
            : ($exception instanceof InvalidArgumentException ? $exception->getMessage() : 'Preview failed. Check the server logs; no database changes were made.');
    }
}

/** Every plan entry with the note item it came from. */
$rows = [];
$ruleRows = [];
if ($result !== null) {
    foreach (['create', 'update', 'delete', 'skipped', 'ambiguous'] as $kind) {
        foreach ($result['build']->plan[$kind] as $entry) {
            $index = NoteEngine::itemIndex((string) $entry['ref']);
            $rows[] = ['kind' => $kind, 'item' => $result['items'][$index ?? -1] ?? '', 'entry' => $entry];
        }
    }
    foreach (['create', 'update', 'delete', 'skipped', 'ambiguous'] as $kind) {
        foreach ($result['rules']->plan[$kind] as $entry) {
            $index = NoteEngine::itemIndex((string) $entry['ref']);
            $ruleRows[] = ['kind' => $kind, 'item' => $result['items'][$index ?? -1] ?? '', 'entry' => $entry];
        }
    }
    $byRef = fn (array $a, array $b): int => strnatcmp($a['entry']['ref'], $b['entry']['ref']);
    usort($rows, $byRef);
    usort($ruleRows, $byRef);
}
$repeatLabel = function (array $entry): string {
    if ($entry['repeat'] === 'never') {
        return '';
    }
    $date = new DateTimeImmutable($entry['due_date']);
    if (isset($entry['repeat_rule'])) {
        // PHP-only development preview; production presentation belongs to the frontend formatter.
        return ' · '.RepeatSchedule::rule($entry['repeat_rule'], $entry['due_date'])->humanReadable(['locale' => 'en', 'include_start' => false]);
    }

    return ' · '.match ($entry['repeat']) {
        'daily' => 'every day',
        'weekly' => 'every '.$date->format('l'),
        'monthly' => 'every month on day '.$date->format('j').((int) $date->format('j') > 28 ? ' (last day in shorter months)' : ''),
        'yearly' => 'every year on '.$date->format('F j').' (last day in shorter months)',
    };
};
$describe = function (string $kind, array $entry) use ($result, $repeatLabel): string {
    $title = fn (?string $id): string => $result['titles'][$id] ?? (string) $id;

    return match ($kind) {
        'create' => trim('"'.$entry['title'].'" '.($entry['due_date'] ?? 'no date').' '.($entry['start_time'] ?? '').($entry['end_time'] ? '–'.$entry['end_time'] : '')
            .($entry['project_id'] ? ' · project' : '').$repeatLabel($entry).($entry['reminder'] !== 'none' ? ' · reminder '.$entry['reminder'] : '')
            .($entry['priority'] !== 'low' ? ' · '.$entry['priority'] : '').($entry['duplicate_of'] ? ' · looks like "'.$title($entry['duplicate_of']).'"' : '')),
        'update' => '"'.$title($entry['task_id']).'" → '.json_encode(array_diff_key($entry, array_flip(['ref', 'task_id', 'label'])), JSON_UNESCAPED_UNICODE).' · label "'.$entry['label'].'"',
        'delete' => '"'.$title($entry['task_id']).'"',
        'skipped' => $entry['reason'],
        'ambiguous' => 'Which task did you mean? '.implode(' / ', array_map($title, $entry['candidates'])).' (preselected "'.$title($entry['preselected']).'")',
    };
};
$outcomeOf = function (string $ref) use ($result): array {
    $outcomes = $result['build']->itemOutcomes;
    if (isset($outcomes[$ref])) {
        return $outcomes[$ref];
    }
    $root = explode('-', $ref)[0];
    $knownCommand = in_array($ref, array_column([...$result['rules']->plan['update'], ...$result['rules']->plan['delete']], 'ref'), true);
    if (! $knownCommand && isset($outcomes[$root])) {
        return $outcomes[$root];
    }
    if (isset($result['rules']->lowConfidence[$ref]) || (! $knownCommand && isset($result['rules']->lowConfidence[$root]))) {
        return ['source' => 'rules preview', 'status' => 'provisional', 'reason' => 'LLM not run'];
    }

    return ['source' => 'rules', 'status' => 'accepted', 'reason' => 'rules_confident'];
};
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Try notes</title>
<style>
  body { font: 15px/1.45 system-ui, sans-serif; margin: 0 auto; max-width: 1100px; padding: 16px; color: #1d1d1f; background: #fafafa; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  label { display: grid; gap: 4px; font-weight: 600; font-size: 13px; }
  textarea, input, select { font: 14px ui-monospace, monospace; padding: 8px; border: 1px solid #ccc; border-radius: 6px; background: #fff; }
  textarea { min-height: 160px; resize: vertical; }
  .row { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; grid-column: 1 / -1; }
  button { font-size: 15px; padding: 9px 22px; border: 0; border-radius: 6px; background: #1d1d1f; color: #fff; cursor: pointer; }
  .hint { grid-column: 1 / -1; font-size: 12px; color: #666; margin: 0; }
  .summary { margin: 18px 0 8px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .pill { padding: 3px 10px; border-radius: 99px; font-weight: 600; font-size: 13px; }
  .done { background: #d9f2df; } .confirm { background: #ffe7c2; } .followup { background: #e3e3f7; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 14px; }
  th { font-size: 12px; color: #666; }
  .kind { font: 600 12px ui-monospace, monospace; text-transform: uppercase; white-space: nowrap; }
  .error { background: #fde2e2; padding: 10px; border-radius: 6px; margin-top: 16px; }
  .notice { background: #e3e3f7; padding: 10px; border-radius: 6px; }
  fieldset { border: 1px solid #ccc; border-radius: 6px; padding: 12px; }
  legend { font-weight: 600; }
  select { max-width: 100%; }
  td { overflow-wrap: anywhere; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #eee; padding: 12px; border-radius: 6px; }
  details { margin: 16px 0; }
  h2 { font-size: 17px; margin-top: 24px; }
  @media (max-width: 700px) { form { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Try notes</h1>
<p class="hint">Preview only. No tasks or notes are saved. LLM mode sends low-confidence text and relevant candidate task titles to the selected provider; provider quotas still apply. Keys stay on the server.</p>
<form method="post">
  <input type="hidden" name="csrf" value="<?= $e($_SESSION['csrf']) ?>">
  <label>Note<textarea name="note" autofocus><?= $e($form['note']) ?></textarea></label>
  <label>Existing tasks<textarea name="tasks"><?= $e($form['tasks']) ?></textarea></label>
  <p class="hint">Tasks: one per line, <code>task: Title | 2026-10-26 | 09:00-10:00</code> for an open task (date and times optional), <code>done: Title</code> for a done one.</p>
  <div class="row">
    <label>Written at<input type="datetime-local" name="now" value="<?= $e($form['now']) ?>"></label>
    <label>Time zone<input name="timezone" value="<?= $e($form['timezone']) ?>"></label>
    <label>Week starts<select name="week"><option value="mon"<?= $form['week'] === 'mon' ? ' selected' : '' ?>>Monday</option><option value="sun"<?= $form['week'] === 'sun' ? ' selected' : '' ?>>Sunday</option></select></label>
  </div>
  <fieldset class="row">
    <legend>Fallback settings</legend>
    <label>Mode<select name="mode"><option value="rules"<?= $form['mode'] === 'rules' ? ' selected' : '' ?>>Rules only</option><option value="llm"<?= $form['mode'] === 'llm' ? ' selected' : '' ?>>Rules + LLM (low confidence only)</option></select></label>
    <label>Provider / model<select name="profile" id="model-profile">
      <?php foreach ($profiles as $id => $profile) { ?><option value="<?= $e($id) ?>"<?= $form['profile'] === $id ? ' selected' : '' ?><?= ! $profile['configured'] ? ' disabled' : '' ?>><?= $e($profile['label'].(! $profile['configured'] ? ' — key missing' : '')) ?></option><?php } ?>
    </select></label>
    <label>Timeout (seconds)<input type="number" name="timeout" min="1" max="30" step="1" value="<?= $e($form['timeout']) ?>"></label>
    <label id="custom-model-label">Custom OpenRouter model<input name="custom_model" value="<?= $e($form['custom_model']) ?>" placeholder="vendor/model:free" maxlength="200"></label>
    <p class="hint">Prompt: note-plan-v6 · Reasoning off · Timeout is for this preview only. Confident items do not call the model.</p>
  </fieldset>
  <div class="row">
    <button type="submit" id="run-preview">Run preview</button>
  </div>
</form>

<?php if ($error !== null) { ?>
  <div class="error"><?= $e($error) ?></div>
<?php } elseif ($result !== null) { ?>
  <div class="summary">
    <span class="pill <?= $e($result['build']->status->value) ?>"><?= $e($result['build']->status->value) ?></span>
    <span class="pill"><?= $e($result['build']->engine->value) ?></span>
    <strong><?= $e($result['build']->name) ?></strong>
    <span>· <?= $e(sprintf('%.0f ms total · %.0f ms rules (budget %d ms)', $result['ms'], $result['rules_ms'], (int) config('notes.engine_budget_ms'))) ?></span>
    <?php if ($result['build']->plan['dropped'] > 0) { ?><span>· <?= $e((string) $result['build']->plan['dropped']) ?> dropped by validation</span><?php } ?>
    <?php if ($result['build']->plan['needs_confirm']) { ?><span>· needs confirm</span><?php } ?>
    <?php if ($result['build']->lowConfidence !== []) { ?><span>· low confidence: <?= $e(implode(' / ', $result['build']->lowConfidence)) ?></span><?php } ?>
  </div>
  <?php if ($result['llm'] === null && $result['rules']->lowConfidence !== []) { ?><p class="error">Rules preview only: these items need fallback processing. Their dates and recurrence are not confirmed. Select Rules + LLM to try fallback.</p>
  <?php } elseif ($result['llm'] !== null && $result['rules']->lowConfidence === []) { ?><p class="notice">No low-confidence items: no model request was sent.</p>
  <?php } elseif ($result['build']->engine->value === 'rules_fallback') { ?><p class="error">Fallback did not produce an accepted proposal. Unresolved writes are held, not replaced with provisional rules actions. Check each row's outcome and the HTTP details below. The original rules preview is shown separately for comparison.</p>
  <?php } elseif ($result['llm'] !== null) { ?><p class="notice">LLM proposals were merged after server validation. Review the meaning and dates; accepted JSON alone does not prove a correct interpretation. A followup/unclear result needs the user to clarify the note.</p><?php } ?>
  <?php if ($result['llm'] !== null) { ?>
    <p><strong><?= $e($result['llm']['provider']) ?></strong> · <?= $e($result['llm']['model']) ?> · <?= count($result['llm']['http']) ?> request(s)</p>
  <?php } ?>
  <?php if ($result['rules']->lowConfidence !== []) { ?>
    <h2>Low-confidence input</h2>
    <ul><?php foreach ($result['rules']->lowConfidence as $ref => $item) { ?><li><code><?= $e($ref) ?></code>: <?= $e($item) ?></li><?php } ?></ul>
  <?php } ?>
  <h2><?= $result['llm'] === null && $result['rules']->lowConfidence !== [] ? 'Rules preview (not actionable)' : 'Final preview' ?></h2>
  <table>
    <tr><th>Item</th><th>Source</th><th>Outcome</th><th>Kind</th><th>Result</th></tr>
    <?php foreach ($rows as $row) { ?>
      <?php $outcome = $outcomeOf($row['entry']['ref']); ?>
      <tr><td><code><?= $e($row['entry']['ref']) ?></code> <?= $e($row['item']) ?></td><td><?= $e($outcome['source']) ?>
        <?php if (isset($outcome['field_sources'])) { ?><details class="field-sources"><summary>Fields</summary><ul><?php foreach ($outcome['field_sources'] as $field => $source) { ?><li><?= $e($field) ?>: <?= $e($source) ?></li><?php } ?></ul></details><?php } ?>
      </td><td><?= $e($outcome['status']) ?><br><small><?= $e($outcome['reason']) ?></small></td><td class="kind"><?= $e($row['kind']) ?></td><td><?= $e($describe($row['kind'], $row['entry'])) ?></td></tr>
    <?php } ?>
  </table>
  <?php if ($result['llm'] !== null) { ?>
    <details open><summary>Before fallback: rules preview</summary>
      <table><tr><th>Item</th><th>Kind</th><th>Result</th></tr>
      <?php foreach ($ruleRows as $row) { ?><tr><td><?= $e($row['item']) ?></td><td class="kind"><?= $e($row['kind']) ?></td><td><?= $e($describe($row['kind'], $row['entry'])) ?></td></tr><?php } ?>
      </table>
    </details>
    <details><summary>HTTP status, latency, tokens and raw model output (no credentials)</summary><pre><?= $e(json_encode($result['llm']['http'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></pre></details>
  <?php } ?>
  <details><summary>Final plan JSON</summary><pre><?= $e(json_encode(['status' => $result['build']->status->value, 'engine' => $result['build']->engine->value, 'processing' => $result['build']->itemOutcomes, 'plan' => $result['build']->plan], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></pre></details>
<?php } ?>
<script>
const profile = document.getElementById('model-profile');
const custom = document.getElementById('custom-model-label');
const showCustom = () => { custom.hidden = profile.value !== 'openrouter_custom'; };
profile.addEventListener('change', showCustom);
showCustom();
document.querySelector('form').addEventListener('submit', () => {
  const button = document.getElementById('run-preview');
  button.disabled = true;
  button.textContent = 'Running…';
});
</script>
</body>
</html>
