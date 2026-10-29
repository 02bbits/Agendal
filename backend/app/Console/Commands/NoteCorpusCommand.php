<?php

namespace App\Console\Commands;

use App\Services\Notes\CorpusRunner;
use Illuminate\Console\Command;

class NoteCorpusCommand extends Command
{
    protected $signature = 'notes:corpus {--mode=rules}';

    protected $description = 'Check note corpus quotas and accuracy gates';

    public function handle(CorpusRunner $runner): int
    {
        $mode = $this->option('mode');
        if (! in_array($mode, ['rules', 'llm'], true)) {
            $this->error('Mode must be rules or llm');

            return self::FAILURE;
        }
        if ($mode === 'llm' && (! config('note_llm.enabled') || ! config('note_llm.key') || ! config('note_llm.model'))) {
            $this->error('LLM mode requires NOTE_LLM_ENABLED, OPENROUTER_API_KEY and NOTE_LLM_MODEL');

            return self::FAILURE;
        }
        $cases = $runner->load(glob(base_path('../docs/06-testing/note-corpus/*.yaml')) ?: []);
        $quotas = $runner->quotas($cases);
        $report = $runner->run($cases, $mode);
        $rows = [];
        foreach ($report['gates'] as $metric => $gate) {
            $rows[] = [$metric, $gate['correct'], $gate['total'], round(100 * $gate['accuracy'], 2).'%', 100 * $gate['required'].'%'];
        }
        $this->table(['Gate', 'Correct', 'Total', 'Accuracy', 'Required'], $rows);
        foreach ($quotas as $issue) {
            $this->error($issue);
        }
        foreach ($report['failures'] as $id => $metrics) {
            $this->line($id.': '.implode(', ', array_keys($metrics)));
        }
        $this->info($report['cases'].' cases; '.$report['llm_notes'].' used the model');

        return $quotas === [] && $report['passed'] ? self::SUCCESS : self::FAILURE;
    }
}
