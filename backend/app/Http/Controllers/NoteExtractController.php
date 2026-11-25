<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use DOMDocument;
use DOMXPath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use ZipArchive;

class NoteExtractController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:2048'],
        ]);

        $file = $validated['file'];
        $extension = strtolower($file->getClientOriginalExtension());

        if (! in_array($extension, ['txt', 'md', 'pdf', 'doc', 'docx'], true)) {
            throw ValidationException::withMessages([
                'file' => 'Unsupported file type.',
            ]);
        }

        $path = $file->getRealPath();

        if ($path === false) {
            throw ValidationException::withMessages([
                'file' => 'Could not read the uploaded file.',
            ]);
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => 'Could not read the uploaded file.',
            ]);
        }

        $signature = fread($handle, 8);
        fclose($handle);
        if ($signature === false) {
            throw ValidationException::withMessages([
                'file' => 'Could not read the uploaded file.',
            ]);
        }

        $validSignature = match ($extension) {
            'pdf' => str_starts_with($signature, '%PDF-'),
            'doc' => str_starts_with($signature, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"),
            'docx' => str_starts_with($signature, 'PK'),
            default => true,
        };

        if (! $validSignature) {
            throw ValidationException::withMessages([
                'file' => 'The file does not match its extension.',
            ]);
        }

        $text = match ($extension) {
            'txt', 'md' => file_get_contents($path),
            'pdf' => $this->extractWithCommand([
                'pdftotext', '-enc', 'UTF-8', '-nopgbrk', $path, '-',
            ]),
            'doc' => $this->extractWithCommand([
                'antiword', '-m', 'UTF-8.txt', $path,
            ]),
            'docx' => $this->extractDocx($path),
        };

        if (! is_string($text) || ! mb_check_encoding($text, 'UTF-8')) {
            throw ValidationException::withMessages([
                'file' => 'The document could not be read as UTF-8 text.',
            ]);
        }

        $text = trim(str_replace("\r\n", "\n", $text));

        if ($text === '') {
            throw ValidationException::withMessages([
                'file' => 'No readable text was found in this document.',
            ]);
        }

        if (mb_strlen($text) > (int) config('notes.max_length', 5000)) {
            throw ValidationException::withMessages([
                'file' => 'The extracted text is too long for a note (5000 characters maximum).',
            ]);
        }

        return response()->json([
            'text' => $text,
        ]);
    }

    /**
     * @param  list<string>  $command
     */
    private function extractWithCommand(array $command): string
    {
        $process = new Process([
            'prlimit',
            '--as=536870912',
            '--',
            ...$command,
        ]);

        $process->setTimeout(15);

        try {
            $process->run();
        } catch (ProcessTimedOutException) {
            throw ValidationException::withMessages([
                'file' => 'Document extraction timed out.',
            ]);
        }

        if (! $process->isSuccessful()) {
            throw ValidationException::withMessages([
                'file' => 'Could not extract text from this document.',
            ]);
        }

        return $process->getOutput();
    }

    private function extractDocx(string $path): string
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw ValidationException::withMessages([
                'file' => 'Could not open the Word document.',
            ]);
        }

        try {
            // Limit the number of entries in the DOCX archive.
            if ($zip->numFiles > 1000) {
                throw ValidationException::withMessages([
                    'file' => 'The Word document contains too many files.',
                ]);
            }

            // Limit the declared total uncompressed size of the archive.
            $totalSize = 0;

            for ($index = 0; $index < $zip->numFiles; $index++) {
                $entry = $zip->statIndex($index);

                if ($entry === false) {
                    throw ValidationException::withMessages([
                        'file' => 'Invalid Word document archive.',
                    ]);
                }

                $totalSize += $entry['size'];

                if ($totalSize > 20 * 1024 * 1024) {
                    throw ValidationException::withMessages([
                        'file' => 'The Word document is too large to extract safely.',
                    ]);
                }
            }

            // The document XML itself must also stay within 2 MB.
            $stats = $zip->statName('word/document.xml');

            if (! $stats || $stats['size'] > 2 * 1024 * 1024) {
                throw ValidationException::withMessages([
                    'file' => 'Invalid or oversized Word document.',
                ]);
            }

            $xml = $zip->getFromName('word/document.xml');
        } finally {
            $zip->close();
        }

        if ($xml === false) {
            throw ValidationException::withMessages([
                'file' => 'No readable document content was found.',
            ]);
        }

        $document = new DOMDocument;

        if (! @$document->loadXML($xml, LIBXML_NONET)) {
            throw ValidationException::withMessages([
                'file' => 'Invalid Word document content.',
            ]);
        }

        $xpath = new DOMXPath($document);
        $xpath->registerNamespace(
            'w',
            'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        );

        $paragraphs = [];

        $paragraphNodes = $xpath->query('//w:body//w:p');

        if ($paragraphNodes === false) {
            throw ValidationException::withMessages([
                'file' => 'Could not read Word document paragraphs.',
            ]);
        }

        foreach ($paragraphNodes as $paragraph) {
            if (! $paragraph instanceof \DOMNode) {
                continue;
            }
            $parts = [];

            $textNodes = $xpath->query('.//w:t', $paragraph);

            if ($textNodes === false) {
                throw ValidationException::withMessages([
                    'file' => 'Could not read Word document text.',
                ]);
            }

            foreach ($textNodes as $node) {
                $parts[] = $node->nodeValue ?? '';
            }

            $line = trim(implode('', $parts));

            if ($line !== '') {
                $paragraphs[] = $line;
            }

        }

        return implode("\n", $paragraphs);
    }
}
