<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Notes\NoteTranscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class NoteDictationController extends Controller
{
    public function __invoke(Request $request, NoteTranscriber $transcriber): JsonResponse
    {
        // WAV from the dictation sheet's recorder: 16 kHz mono, 2 minutes at most (NC §2.3), about 3.8 MB
        $request->validate(['audio' => ['required', 'file', 'mimetypes:audio/wav,audio/x-wav,audio/wave', 'max:'.config('note_llm.dictation_max_kb')]]);
        $audio = $request->file('audio');
        assert($audio instanceof UploadedFile);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['text' => $transcriber->transcribe((string) $audio->get(), $user->id)]);
    }
}
