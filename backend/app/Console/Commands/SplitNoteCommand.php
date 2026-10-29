<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Notes\NoteSplitter;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

class SplitNoteCommand extends Command
{
    protected $signature = 'notes:split {text? : A note to split} {--file= : Read a UTF-8 note file} {--project=* : Known project name; repeat for multiple projects}';

    protected $description = 'Try the actual note splitter with a note or file';

    public function handle(NoteSplitter $splitter): int
    {
        $text = $this->argument('text');
        $file = $this->option('file');
        if ($text !== null && $file !== null) {
            $this->error('Choose one note argument or --file.');

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
            $this->error('Supply a note or --file=path.');

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

}
