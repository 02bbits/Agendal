<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Support\NoteSplitterScenarios;
use App\Services\Notes\NoteSplitter;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

class SplitNoteCommand extends Command
{
    protected $signature = 'notes:split {text? : A note to split} {--file= : Read a UTF-8 note file} {--project=* : Known project name; repeat for multiple projects} {--scenarios : Run all dynamically generated rule scenarios} {--filter= : Run scenario names containing this text}';

    protected $description = 'Try the actual note splitter or run its developer scenarios';

    public function handle(NoteSplitter $splitter): int
    {
        $text = $this->argument('text');
        $file = $this->option('file');
        if ($this->option('scenarios')) {
            if ($text !== null || $file !== null || $this->option('project') !== []) {
                $this->error('Use --scenarios on its own, optionally with --filter.');

                return self::FAILURE;
            }

            return $this->scenarios($splitter);
        }
        if ($this->option('filter') !== null || ($text !== null && $file !== null)) {
            $this->error('Choose one note argument or --file. Use --filter with --scenarios.');

            return self::FAILURE;
        }
        if ($file !== null) {
            if (! is_file($file) || ! is_readable($file)) {
                $this->error('Cannot read the note file.');

                return self::FAILURE;
            }
            $text = file_get_contents($file);
        }
        if ($text === null) {
            $this->error('Supply a note, --file=path, or --scenarios.');

            return self::FAILURE;
        }
        try {
            $projects = array_values(array_filter($this->option('project'), fn ($project): bool => is_string($project) && $project !== ''));
            $items = $splitter->split((string) $text, $projects);
            $this->line((string) json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        } catch (ValidationException $error) {
            $this->error($error->errors()['text'][0]);

            return self::FAILURE;
        }
    }

    private function scenarios(NoteSplitter $splitter): int
    {
        $cases = NoteSplitterScenarios::generate(resource_path('notes/splitter-rules.csv'));
        $filter = $this->option('filter');
        $failed = 0;
        $total = 0;
        foreach ($cases as $name => [$text, $expected, $expectedError, $projects]) {
            if (is_string($filter) && ! str_contains($name, $filter)) {
                continue;
            }
            $total++;
            $actual = [];
            $actualError = '';
            try {
                $actual = $splitter->split($text, $projects);
            } catch (ValidationException $error) {
                $actualError = $error->errors()['text'][0];
            }
            $passed = $actualError === $expectedError && ($expectedError !== '' || $actual === $expected);
            $this->line(($passed ? 'PASS ' : 'FAIL ').$name);
            if (! $passed) {
                $failed++;
                $this->line('Input: '.json_encode($text, JSON_UNESCAPED_UNICODE));
                $this->line('Expected: '.json_encode($expectedError ?: $expected, JSON_UNESCAPED_UNICODE));
                $this->line('Actual: '.json_encode($actualError ?: $actual, JSON_UNESCAPED_UNICODE));
            }
        }
        $this->info($total.' scenarios; '.$failed.' failed');

        return $total > 0 && $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
