<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use ZipArchive;

class NoteExtractTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/v1/notes/extract';

    private function authenticate(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user);
    }

    public function test_guest_cannot_upload_a_document(): void
    {
        $file = UploadedFile::fake()->createWithContent(
            'tasks.txt',
            'Buy groceries tomorrow.'
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])->assertUnauthorized();
    }

    public function test_txt_file_is_extracted(): void
    {
        $this->authenticate();

        $text = "Buy groceries tomorrow.\nCall the dentist on Friday.";

        $file = UploadedFile::fake()->createWithContent(
            'tasks.txt',
            $text
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('text', $text);
    }

    public function test_markdown_file_is_extracted(): void
    {
        $this->authenticate();

        $text = "# Tasks\n- Buy groceries\n- Call the dentist";

        $file = UploadedFile::fake()->createWithContent(
            'tasks.md',
            $text
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('text', $text);
    }

    public function test_unsupported_extension_is_rejected(): void
    {
        $this->authenticate();

        $file = UploadedFile::fake()->createWithContent(
            'script.exe',
            'Some content'
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'error.invalid')
            ->assertJsonStructure([
                'error' => [
                    'fields' => ['file'],
                ],
            ]);
    }

    public function test_empty_document_is_rejected(): void
    {
        $this->authenticate();

        $file = UploadedFile::fake()->createWithContent(
            'empty.txt',
            ''
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'error.invalid')
            ->assertJsonStructure([
                'error' => [
                    'fields' => ['file'],
                ],
            ]);
    }

    public function test_too_long_document_is_rejected(): void
    {
        $this->authenticate();

        $file = UploadedFile::fake()->createWithContent(
            'long.txt',
            str_repeat('A', 5001)
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'error.invalid')
            ->assertJsonStructure([
                'error' => [
                    'fields' => ['file'],
                ],
            ]);
    }

    public function test_invalid_pdf_signature_is_rejected(): void
    {
        $this->authenticate();

        $file = UploadedFile::fake()->createWithContent(
            'invalid.pdf',
            'This is not a PDF document.'
        );

        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'error.invalid')
            ->assertJsonStructure([
                'error' => [
                    'fields' => ['file'],
                ],
            ]);
    }

    public function test_missing_file_is_rejected(): void
    {
        $this->authenticate();

        $this->post(self::ENDPOINT, [], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'error.invalid')
            ->assertJsonStructure([
                'error' => [
                    'fields' => ['file'],
                ],
            ]);
    }

    public function test_oversized_docx_archive_is_rejected(): void
    {
        $this->authenticate();

        $path = tempnam(sys_get_temp_dir(), 'agendal-docx-');
        $this->assertNotFalse($path);

        $zip = new ZipArchive;
        $this->assertTrue(
            $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE)
        );

        $zip->addFromString(
            'word/document.xml',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            .'<w:body><w:p><w:r><w:t>Buy groceries</w:t></w:r></w:p></w:body>'
            .'</w:document>'
        );

        // Small compressed file, but over 20 MB when uncompressed.
        $zip->addFromString(
            'word/media/oversized.txt',
            str_repeat('A', 21 * 1024 * 1024)
        );

        $this->assertTrue($zip->close());

        try {
            $file = new UploadedFile(
                $path,
                'oversized.docx',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                null,
                true
            );

            $this->post(self::ENDPOINT, ['file' => $file], [
                'Accept' => 'application/json',
            ])
                ->assertUnprocessable()
                ->assertJsonPath('error.code', 'error.invalid')
                ->assertJsonStructure([
                    'error' => [
                        'fields' => ['file'],
                    ],
                ]);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_docx_file_is_extracted(): void
    {
        $this->authenticate();

        $file = new UploadedFile(
            base_path('tests/Fixtures/Documents/03_tasks.docx'),
            'tasks.docx',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            null,
            true
        );

        $response = $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertStringContainsString(
            'Buy groceries tomorrow.',
            $response->json('text')
        );
    }

    public function test_pdf_file_is_extracted(): void
    {
        $this->authenticate();

        $file = new UploadedFile(
            base_path('tests/Fixtures/Documents/04_tasks.pdf'),
            'tasks.pdf',
            'application/pdf',
            null,
            true
        );

        $response = $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertStringContainsString(
            'Buy groceries tomorrow.',
            $response->json('text')
        );
    }

    public function test_doc_file_is_extracted(): void
    {
        $this->authenticate();

        $file = new UploadedFile(
            base_path('tests/Fixtures/Documents/05_tasks.doc'),
            'tasks.doc',
            'application/msword',
            null,
            true
        );

        $response = $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertStringContainsString(
            'Buy groceries tomorrow.',
            $response->json('text')
        );
    }
}
