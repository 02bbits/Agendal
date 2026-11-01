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
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$form = [
    'note' => (string) ($_POST['note'] ?? "sql quiz monday 9am, done call mum\npush email the group back 1 hour\ndelete old list"),
    'tasks' => (string) ($_POST['tasks'] ?? "task: Call mum\ntask: Email the group | 2026-10-23 | 09:00-10:00\ntask: Old list\ndone: Pay rent"),
    'now' => (string) ($_POST['now'] ?? (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d\TH:i')),
    'timezone' => (string) ($_POST['timezone'] ?? 'Asia/Ho_Chi_Minh'),
    'week' => (string) ($_POST['week'] ?? 'mon'),
];
$e = fn (mixed $value): string => htmlspecialchars(is_string($value) ? $value : (string) json_encode($value, JSON_UNESCAPED_UNICODE), ENT_QUOTES);

$result = null;
$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
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
        $result = [
            'build' => $build,
            'ms' => (hrtime(true) - $started) / 1e6,
            'items' => app(NoteSplitter::class)->split($text),
            'titles' => array_column([...$open, ...$done], 'title', 'id'),
        ];
    } catch (Throwable $exception) {
        $error = $exception instanceof ValidationException
            ? implode(', ', array_merge(...array_values($exception->errors())))
            : $exception::class.': '.$exception->getMessage();
    }
}

/** Every plan entry with the note item it came from. */
$rows = [];
if ($result !== null) {
    foreach (['create', 'update', 'delete', 'skipped', 'ambiguous'] as $kind) {
        foreach ($result['build']->plan[$kind] as $entry) {
            $index = NoteEngine::itemIndex((string) $entry['ref']);
            $rows[] = ['kind' => $kind, 'item' => $result['items'][$index ?? -1] ?? '', 'entry' => $entry];
        }
    }
}
$describe = function (string $kind, array $entry) use ($result): string {
    $title = fn (?string $id): string => $result['titles'][$id] ?? (string) $id;

    return match ($kind) {
        'create' => trim('"'.$entry['title'].'" '.($entry['due_date'] ?? 'no date').' '.($entry['start_time'] ?? '').($entry['end_time'] ? '–'.$entry['end_time'] : '')
            .($entry['project_id'] ? ' · project' : '').($entry['repeat'] !== 'never' ? ' · repeats '.$entry['repeat'] : '').($entry['reminder'] !== 'none' ? ' · reminder '.$entry['reminder'] : '')
            .($entry['priority'] !== 'low' ? ' · '.$entry['priority'] : '').($entry['duplicate_of'] ? ' · looks like "'.$title($entry['duplicate_of']).'"' : '')),
        'update' => '"'.$title($entry['task_id']).'" → '.json_encode(array_diff_key($entry, array_flip(['ref', 'task_id', 'label'])), JSON_UNESCAPED_UNICODE).' · label "'.$entry['label'].'"',
        'delete' => '"'.$title($entry['task_id']).'"',
        'skipped' => $entry['reason'],
        'ambiguous' => 'Which task did you mean? '.implode(' / ', array_map($title, $entry['candidates'])).' (preselected "'.$title($entry['preselected']).'")',
    };
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
  .kind { font: 600 12px ui-monospace, monospace; text-transform: uppercase; }
  .error { background: #fde2e2; padding: 10px; border-radius: 6px; margin-top: 16px; }
  @media (max-width: 700px) { form { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Try notes</h1>
<form method="post">
  <label>Note<textarea name="note" autofocus><?= $e($form['note']) ?></textarea></label>
  <label>Existing tasks<textarea name="tasks"><?= $e($form['tasks']) ?></textarea></label>
  <p class="hint">Tasks: one per line, <code>task: Title | 2026-10-26 | 09:00-10:00</code> for an open task (date and times optional), <code>done: Title</code> for a done one.</p>
  <div class="row">
    <label>Written at<input type="datetime-local" name="now" value="<?= $e($form['now']) ?>"></label>
    <label>Time zone<input name="timezone" value="<?= $e($form['timezone']) ?>"></label>
    <label>Week starts<select name="week"><option value="mon"<?= $form['week'] === 'mon' ? ' selected' : '' ?>>Monday</option><option value="sun"<?= $form['week'] === 'sun' ? ' selected' : '' ?>>Sunday</option></select></label>
    <button type="submit">Make tasks</button>
  </div>
</form>

<?php if ($error !== null) { ?>
  <div class="error"><?= $e($error) ?></div>
<?php } elseif ($result !== null) { ?>
  <div class="summary">
    <span class="pill <?= $e($result['build']->status->value) ?>"><?= $e($result['build']->status->value) ?></span>
    <strong><?= $e($result['build']->name) ?></strong>
    <span>· <?= $e(sprintf('%.0f ms (budget %d ms)', $result['ms'], (int) config('notes.engine_budget_ms'))) ?></span>
    <?php if ($result['build']->plan['dropped'] > 0) { ?><span>· <?= $e((string) $result['build']->plan['dropped']) ?> dropped by validation</span><?php } ?>
    <?php if ($result['build']->plan['needs_confirm']) { ?><span>· needs confirm</span><?php } ?>
    <?php if ($result['build']->lowConfidence !== []) { ?><span>· low confidence: <?= $e(implode(' / ', $result['build']->lowConfidence)) ?></span><?php } ?>
  </div>
  <table>
    <tr><th>Item</th><th>Kind</th><th>Result</th></tr>
    <?php foreach ($rows as $row) { ?>
      <tr><td><?= $e($row['item']) ?></td><td class="kind"><?= $e($row['kind']) ?></td><td><?= $e($describe($row['kind'], $row['entry'])) ?></td></tr>
    <?php } ?>
  </table>
<?php } ?>
</body>
</html>
