<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use DOMDocument;
use DOMNode;
use DOMXPath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use ZipArchive;

/**
 * Reads the text out of an uploaded document for the note editor. Nothing is stored: the
 * upload stays in PHP's temp file and is gone when the request ends. Field errors are copy keys.
 */
class NoteExtractController extends Controller
{
    /** Bytes of extractor output read before giving up: well past a 5,000-character note. */
    private const OUTPUT_CAP = 50_000;

    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate(['file' => ['required', 'file', 'max:2048']], [
            'file.max' => 'note.upload_too_large',
            'file.required' => 'note.file_failed',
            'file.file' => 'note.file_failed',
        ]);

        $file = $validated['file'];
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if (! in_array($extension, ['txt', 'md', 'pdf', 'docx'], true)) {
            $this->fail('note.file_type');
        }

        if ($path === false || ($signature = file_get_contents($path, length: 5)) === false) {
            $this->fail('note.file_failed');
        }

        $validSignature = match ($extension) {
            'pdf' => str_starts_with($signature, '%PDF-'),
            'docx' => str_starts_with($signature, 'PK'),
            default => true,
        };

        if (! $validSignature) {
            $this->fail('note.file_type');
        }

        $text = match ($extension) {
            'txt', 'md' => file_get_contents($path),
            // First 20 pages: enough for a note, and a cap on a PDF built to keep the parser busy
            'pdf' => $this->extractWithCommand(['pdftotext', '-l', '20', '-enc', 'UTF-8', '-nopgbrk', $path, '-']),
            'docx' => $this->extractDocx($path),
        };

        if (! is_string($text) || ! mb_check_encoding($text, 'UTF-8')) {
            $this->fail('note.file_failed');
        }

        $text = trim(str_replace("\r\n", "\n", $text));

        if ($text === '') {
            $this->fail('note.file_no_text');
        }

        if (mb_strlen($text) > (int) config('notes.max_length', 5000)) {
            $this->fail('note.upload_too_long');
        }

        return response()->json(['text' => $text]);
    }

    private function fail(string $code): never
    {
        throw ValidationException::withMessages(['file' => [$code]]);
    }

    /**
     * Runs a parser on the upload with a memory cap, a 10 s timeout (NF-17) and none of the app's
     * environment, so a parser bug can't read the database password or API keys.
     *
     * @param  list<string>  $command
     */
    private function extractWithCommand(array $command): string
    {
        $process = new Process(['env', '-i', 'PATH=/usr/bin:/bin', 'prlimit', '--as=536870912', '--', ...$command]);
        $process->setTimeout(10);

        $bytes = 0;
        $tooLong = false;

        try {
            $process->run(function (string $type, string $data) use ($process, &$bytes, &$tooLong): void {
                if ($type === Process::OUT && ($bytes += strlen($data)) > self::OUTPUT_CAP) {
                    $tooLong = true;
                    $process->stop(0);
                }
            });
        } catch (ProcessTimedOutException) {
            $this->fail('note.file_failed');
        }

        if ($tooLong) {
            $this->fail('note.upload_too_long');
        }

        if (! $process->isSuccessful()) {
            $this->fail(str_contains($process->getErrorOutput(), 'password') ? 'note.file_locked' : 'note.file_failed');
        }

        return $process->getOutput();
    }

    private function extractDocx(string $path): string
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            $this->fail('note.file_failed');
        }

        try {
            if ($zip->numFiles > 1000) {
                $this->fail('note.file_failed');
            }

            // Declared sizes; a read never returns more than the declared size
            $totalSize = 0;

            for ($index = 0; $index < $zip->numFiles; $index++) {
                $entry = $zip->statIndex($index);

                if ($entry === false || ($totalSize += $entry['size']) > 20 * 1024 * 1024) {
                    $this->fail('note.file_failed');
                }
            }

            $stats = $zip->statName('word/document.xml');

            if (! $stats || $stats['size'] > 2 * 1024 * 1024) {
                $this->fail('note.file_failed');
            }

            $xml = $zip->getFromName('word/document.xml');
        } finally {
            $zip->close();
        }

        $document = new DOMDocument;

        // A real document.xml has no DTD. Entities left unexpanded at parse time would expand on
        // read, outside PHP's memory_limit: a few hundred bytes can ask for gigabytes.
        if ($xml === false || ! @$document->loadXML($xml, LIBXML_NONET) || $document->doctype !== null) {
            $this->fail('note.file_failed');
        }

        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('w', self::W);
        $xpath->registerNamespace('mc', 'http://schemas.openxmlformats.org/markup-compatibility/2006');

        $paragraphs = [];

        // Word writes a text box twice (Choice and Fallback): read the Choice copy only
        foreach ($xpath->query('//w:body//w:p[not(ancestor::mc:Fallback)]') ?: [] as $paragraph) {
            if (! $paragraph instanceof DOMNode) {
                continue;
            }

            $line = '';

            foreach ($xpath->query('.//w:r/w:t | .//w:r/w:tab | .//w:r/w:br | .//w:r/w:cr', $paragraph) ?: [] as $node) {
                if (! $node instanceof DOMNode) {
                    continue;
                }

                // A text box inside this paragraph is its own paragraph, read on its own
                $owner = $node->parentNode;

                while ($owner !== null && ! ($owner->localName === 'p' && $owner->namespaceURI === $paragraph->namespaceURI)) {
                    $owner = $owner->parentNode;
                }

                if ($owner === null || ! $owner->isSameNode($paragraph)) {
                    continue;
                }

                $line .= match ($node->localName) {
                    't' => $node->textContent,
                    'tab' => "\t",
                    default => "\n",
                };
            }

            $line = trim($line);

            if ($line !== '') {
                $paragraphs[] = $line;
            }
        }

        return implode("\n", $paragraphs);
    }
}
