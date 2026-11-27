<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;
use ZipArchive;

class NoteExtractTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/v1/notes/extract';

    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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
            ->assertJsonPath('error.fields.file.0', 'note.file_type');
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
            ->assertJsonPath('error.fields.file.0', 'note.file_no_text');
    }

    public function test_too_long_document_is_rejected(): void
    {
        $this->authenticate();

        $file = UploadedFile::fake()->createWithContent(
            'long.txt',
            str_repeat('A', 5001)
        );

        // NC-E9: more than a note holds is refused, nothing is added
        $this->post(self::ENDPOINT, ['file' => $file], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.fields.file.0', 'note.file_too_long');
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
            ->assertJsonPath('error.fields.file.0', 'note.file_type');
    }

    public function test_missing_file_is_rejected(): void
    {
        $this->authenticate();

        $this->post(self::ENDPOINT, [], [
            'Accept' => 'application/json',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'error.invalid')
            ->assertJsonPath('error.fields.file.0', 'note.file_failed');
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
                ->assertJsonPath('error.fields.file.0', 'note.file_failed');
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

    public function test_docx_with_a_doctype_is_rejected(): void
    {
        $this->authenticate();

        // Entities stay unexpanded at parse time and would expand on read, outside memory_limit
        $file = $this->docx('<!DOCTYPE w:document [<!ENTITY q "'.str_repeat('B', 1000).'">]>'
            .'<w:document xmlns:w="'.self::W.'"><w:body><w:p><w:r><w:t>'.str_repeat('&q;', 100).'</w:t></w:r></w:p></w:body></w:document>');

        $this->post(self::ENDPOINT, ['file' => $file], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('error.fields.file.0', 'note.file_failed');
    }

    public function test_docx_keeps_tabs_and_breaks_and_reads_a_text_box_once(): void
    {
        $this->authenticate();

        // Word writes a text box twice (Choice and Fallback), nested inside the paragraph that anchors it
        $box = '<w:txbxContent><w:p><w:r><w:t>Box text</w:t></w:r></w:p></w:txbxContent>';
        $file = $this->docx('<w:document xmlns:w="'.self::W.'" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body>'
            .'<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>'
            .'<w:r><w:t>Tab</w:t><w:tab/><w:t>separated</w:t></w:r></w:p>'
            .'<w:p><w:r><w:t>Line</w:t><w:br/><w:t>break</w:t></w:r></w:p>'
            .'<w:p><w:r><w:t>Anchor</w:t></w:r><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>'.$box
            .'</w:drawing></mc:Choice><mc:Fallback><w:pict>'.$box.'</w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>'
            .'</w:body></w:document>');

        $this->post(self::ENDPOINT, ['file' => $file], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('text', "Tab\tseparated\nLine\nbreak\nAnchor\nBox text");
    }

    public function test_pdf_text_past_the_output_cap_is_rejected(): void
    {
        $this->authenticate();

        // 20 pages sharing one content stream: about 90 KB of text from a 3 KB file
        $content = "BT /F1 6 Tf 8 TL 20 780 Td\n".str_repeat('('.str_repeat('Q', 90).") Tj T*\n", 50).'ET';
        $objects = [
            '<</Type/Catalog/Pages 2 0 R>>',
            '<</Type/Pages/Count 20/Kids['.implode(' ', array_map(fn (int $n): string => "$n 0 R", range(5, 24))).']>>',
            '<</Length '.strlen($content).">>\nstream\n$content\nendstream",
            '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
            ...array_fill(0, 20, '<</Type/Page/Parent 2 0 R/Contents 3 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 612 792]>>'),
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n$object\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n"
            .implode('', array_map(fn (int $offset): string => sprintf("%010d 00000 n \n", $offset), $offsets))
            ."trailer\n<</Size ".(count($objects) + 1)."/Root 1 0 R>>\nstartxref\n$xref\n%EOF\n";

        $file = UploadedFile::fake()->createWithContent('bomb.pdf', $pdf);

        // The parser is stopped at the cap: far more than a note holds (NC-E9)
        $this->post(self::ENDPOINT, ['file' => $file], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('error.fields.file.0', 'note.file_too_long');
    }

    private function docx(string $documentXml): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'agendal-docx-');
        $this->assertNotFalse($path);
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE));
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?>'.$documentXml);
        $this->assertTrue($zip->close());
        $bytes = (string) file_get_contents($path);
        unlink($path);

        return UploadedFile::fake()->createWithContent('test.docx', $bytes);
    }

    /** The model on, answering `$answer`. */
    private function modelReads(array $answer): void
    {
        $this->authenticate();
        config(['note_llm.enabled' => true, 'note_llm.provider' => 'gemini', 'note_llm.daily_user_calls' => 20,
            'note_llm.key_file' => tap(tempnam(sys_get_temp_dir(), 'llm'), fn (string $file) => file_put_contents($file, 'test-only'))]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($answer)]]]]]])]);
    }

    /** A photo read by the model, which answers `$answer`. */
    private function uploadPhoto(array $answer, ?string $bytes = null, string $name = 'note.png'): TestResponse
    {
        $this->modelReads($answer);
        $file = UploadedFile::fake()->createWithContent($name, $bytes ?? $this->png(4, 4));

        return $this->post(self::ENDPOINT, ['file' => $file], ['Accept' => 'application/json']);
    }

    private function png(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    /** The bytes of the file the model was sent. */
    private function sentFile(): string
    {
        $sent = Http::recorded()[0][0];

        return (string) base64_decode($sent['contents'][0]['parts'][1]['inline_data']['data'], true);
    }

    /** A PDF of `$count` pages with no text layer, as a scanner makes it. */
    private function scan(int $count): string
    {
        $objects = [
            '<</Type/Catalog/Pages 2 0 R>>',
            '<</Type/Pages/Count '.$count.'/Kids['.implode(' ', array_map(fn (int $n): string => "$n 0 R", range(3, $count + 2))).']>>',
            ...array_fill(0, $count, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>'),
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n$object\nendobj\n";
        }
        $xref = strlen($pdf);

        return $pdf."xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n"
            .implode('', array_map(fn (int $offset): string => sprintf("%010d 00000 n \n", $offset), $offsets))
            ."trailer\n<</Size ".(count($objects) + 1)."/Root 1 0 R>>\nstartxref\n$xref\n%EOF\n";
    }

    public function test_photo_is_read_by_the_model(): void
    {
        $this->uploadPhoto(['writing' => true, 'text' => "Mua sữa\nGọi mẹ"])
            ->assertOk()
            ->assertJsonPath('text', "Mua sữa\nGọi mẹ")
            ->assertJsonPath('file_name', 'note.png');
        Http::assertSent(fn ($request) => str_contains($request->url(), ':generateContent')
            && $request['contents'][0]['parts'][1]['inline_data']['mime_type'] === 'image/png');
    }

    public function test_photo_without_writing_is_rejected(): void
    {
        $this->uploadPhoto(['writing' => false, 'text' => 'made up'])
            ->assertUnprocessable()
            ->assertJsonPath('error.fields.file.0', 'note.file_no_text');
    }

    public function test_photo_reaches_the_model_upright_and_without_its_exif(): void
    {
        // A wide JPEG whose EXIF says "turn 90° clockwise" and carries a place
        $image = imagecreatetruecolor(40, 20);
        ob_start();
        imagejpeg($image);
        $jpeg = (string) ob_get_clean();
        $tiff = 'II*'."\0".pack('V', 8).pack('v', 1).pack('vvVvv', 0x0112, 3, 1, 6, 0).pack('V', 0).'GPS 10.7769 N 106.7009 E';
        $exif = "Exif\0\0".$tiff;
        $jpeg = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);

        $this->uploadPhoto(['writing' => true, 'text' => 'Gọi mẹ'], $jpeg, 'note.jpg')->assertOk();

        $sent = $this->sentFile();
        $this->assertStringNotContainsString('GPS 10.7769', $sent);
        $this->assertStringNotContainsString('Exif', $sent);
        $this->assertSame([20, 40], array_slice((array) getimagesizefromstring($sent), 0, 2));
    }

    public function test_photo_too_large_to_decode_is_refused_before_the_model(): void
    {
        // A few bytes claiming 10,000 × 10,000 pixels: decoding it would need about 400 MB
        $header = pack('NN', 10000, 10000)."\x08\x02\0\0\0";
        $png = "\x89PNG\r\n\x1a\n".pack('N', 13).'IHDR'.$header.pack('N', crc32('IHDR'.$header));

        $this->uploadPhoto(['writing' => true, 'text' => 'never read'], $png)
            ->assertUnprocessable()
            ->assertJsonPath('error.fields.file.0', 'note.file_failed');
        Http::assertNothingSent();
    }

    public function test_scan_is_cut_to_its_first_five_pages_before_the_model(): void
    {
        $this->modelReads(['writing' => true, 'text' => 'Nộp báo cáo']);

        $this->post(self::ENDPOINT, ['file' => UploadedFile::fake()->createWithContent('scan.pdf', $this->scan(7))], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('pages', 7)
            ->assertJsonPath('truncated', true);

        $this->assertSame(5, preg_match_all('#/Type\s*/Page(?!s)#', $this->sentFile()));
    }

    public function test_photo_answers_429_once_the_days_model_calls_are_spent(): void
    {
        $this->modelReads(['writing' => true, 'text' => 'Gọi mẹ']);
        config(['note_llm.daily_user_calls' => 0]);

        $this->post(self::ENDPOINT, ['file' => UploadedFile::fake()->createWithContent('note.png', $this->png(4, 4))], ['Accept' => 'application/json'])
            ->assertStatus(429)
            ->assertJsonPath('error.code', 'error.rate_limited');
        Http::assertNothingSent();
    }
}
