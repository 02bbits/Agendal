<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessNote;
use App\Http\Resources\NoteResultResource;
use App\Models\Note;
use App\Models\User;
use App\Services\Notes\NoteConfirm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function store(Request $request, ProcessNote $process): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $result = $process->handle($user, $request->all());

        return (new NoteResultResource($result['note']))->response()->setStatusCode($result['replay'] ? 200 : 201);
    }

    public function show(Note $note): NoteResultResource
    {
        return new NoteResultResource($note);
    }

    public function apply(Note $note, NoteConfirm $confirm): NoteResultResource
    {
        return new NoteResultResource($confirm->apply($note));
    }

    public function cancel(Note $note, NoteConfirm $confirm): NoteResultResource
    {
        return new NoteResultResource($confirm->cancel($note));
    }
}
