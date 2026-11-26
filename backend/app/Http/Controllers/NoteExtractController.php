<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\Notes\NoteOcr;
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
 * Reads the text out of an uploaded file for the note editor (NC §2.4). Text, Markdown, CSV, Word and PDFs
 * with a text layer are read on the server; photos and PDFs without one go to the app's language model. Nothing is
 * stored: the upload stays in PHP's temp file and is gone when the request ends. Field errors are copy keys.
 */
class NoteExtractController extends Controller
{
    /** Bytes of extractor output read before giving up: well past a 5,000-character note. */
    private const OUTPUT_CAP = 50_000;

    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /** Set when a parser's output passed OUTPUT_CAP: what was read is kept and marked truncated. */
    private bool $outputCut = false;

    public function __invoke(Request $request, NoteOcr $ocr): JsonResponse
    {
        $validated = $request->validate(['file' => ['required', 'file', 'max:'.(int) config('notes.file_max_kb')]], [
            'file.max' => 'note.file_too_big',
            'file.required' => 'note.file_failed',
            'file.file' => 'note.file_failed',
        ]);

        $file = $validated['file'];
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if (! in_array($extension, ['txt', 'md', 'csv', 'pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp'], true)) {
            $this->fail('note.file_type');
        }

        if ($path === false || ($signature = file_get_contents($path, length: 12)) === false) {
            $this->fail('note.file_failed');
        }

        // Magic bytes must match the extension (NC-E7)
        $validSignature = match ($extension) {
            'pdf' => str_starts_with($signature, '%PDF-'),
            'docx' => str_starts_with($signature, 'PK'),
            'jpg', 'jpeg' => str_starts_with($signature, "\xFF\xD8\xFF"),
            'png' => str_starts_with($signature, "\x89PNG"),
            'webp' => str_starts_with($signature, 'RIFF') && substr($signature, 8, 4) === 'WEBP',
            default => true,
        };

        if (! $validSignature) {
            $this->fail('note.file_type');
        }

        $pages = $extension === 'pdf' ? $this->pdfPages($path) : null;
        $truncated = false;
        $text = match ($extension) {
            'txt', 'md', 'csv' => file_get_contents($path),
            // First 20 pages: enough for a note, and a cap on a PDF built to keep the parser busy
            'pdf' => $this->extractWithCommand(['pdftotext', '-l', '20', '-enc', 'UTF-8', '-nopgbrk', $path, '-']),
            'docx' => $this->extractDocx($path),
            default => $ocr->image((string) file_get_contents($path), $extension === 'png' ? 'image/png' : ($extension === 'webp' ? 'image/webp' : 'image/jpeg'))
                ?? $this->fail('note.file_failed'),
        };

        // A PDF without a text layer is a scan: the model reads its first pages (NC-E5)
        if ($extension === 'pdf' && trim($text) === '') {
            $text = $ocr->pdf((string) file_get_contents($path)) ?? $this->fail('note.file_failed');
            $truncated = $pages !== null && $pages > NoteOcr::PDF_PAGES;
        }

        if (! is_string($text) || ! mb_check_encoding($text, 'UTF-8')) {
            $this->fail('note.file_failed');
        }

        $text = trim(str_replace("\r\n", "\n", $text));

        if ($text === '') {
            $this->fail('note.file_no_text');
        }

        // More than a note holds: the start is kept and marked, the editor says so (NC-E9)
        $max = (int) config('notes.max_length', 5000);
        if (mb_strlen($text) > $max) {
            $text = rtrim(mb_substr($text, 0, $max));
            $truncated = true;
        }

        return response()->json([
            'text' => $text,
            'truncated' => $truncated || $this->outputCut,
            'file_name' => basename($file->getClientOriginalName()),
            'pages' => $pages,
        ]);
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

        // Stopped at the cap: keep what was read, marked truncated (NC-E9)
        if ($tooLong) {
            $this->outputCut = true;

            return $process->getOutput();
        }

        if (! $process->isSuccessful()) {
            $this->fail(str_contains($process->getErrorOutput(), 'password') ? 'note.file_locked' : 'note.file_failed');
        }

        return $process->getOutput();
    }

    /** Pages of a PDF from pdfinfo, for the file card; null when it can't tell. */
    private function pdfPages(string $path): ?int
    {
        $process = new Process(['env', '-i', 'PATH=/usr/bin:/bin', 'prlimit', '--as=536870912', '--', 'pdfinfo', $path]);
        $process->setTimeout(10);
        try {
            $process->run();
        } catch (ProcessTimedOutException) {
            return null;
        }

        return preg_match('/^Pages:\s+(\d+)/m', $process->getOutput(), $match) === 1 ? (int) $match[1] : null;
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
