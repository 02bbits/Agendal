<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessNote;
use App\Http\Resources\NoteResultResource;
use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Notes\NoteConfirm;
use App\Services\Notes\NoteFollowup;
use App\Services\Notes\NoteUndo;
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

    public function makeTask(Note $note, NoteFollowup $followup): NoteResultResource
    {
        return new NoteResultResource($followup->makeTask($note));
    }

    public function update(Request $request, Note $note, ProcessNote $process): NoteResultResource
    {
        $user = $request->user();
        assert($user instanceof User);

        return new NoteResultResource($process->replanFollowup($user, $note, $request->all()));
    }

    public function apply(Request $request, Note $note, NoteConfirm $confirm): NoteResultResource
    {
        // Edits from Check this first, by entry ref: only the fields a task patch may set (TK §7).
        $input = $request->validate(['edits' => ['sometimes', 'array'], 'edits.*' => ['array:'.implode(',', Task::PATCHABLE)]]);

        return new NoteResultResource($confirm->apply($note, $input['edits'] ?? []));
    }

    public function cancel(Note $note, NoteConfirm $confirm): NoteResultResource
    {
        return new NoteResultResource($confirm->cancel($note));
    }

    public function undo(Request $request, Note $note, NoteUndo $undo): NoteResultResource
    {
        return new NoteResultResource($undo->undo($note, $request->boolean('confirm_conflicts')));
    }

    public function redo(Note $note, NoteUndo $undo): NoteResultResource
    {
        return new NoteResultResource($undo->redo($note));
    }
}
