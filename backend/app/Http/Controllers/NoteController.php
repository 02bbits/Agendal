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
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['filter' => ['sometimes', 'in:all,made,needs,kept'], 'cursor' => ['nullable', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $query = Note::query();
        match ($input['filter'] ?? 'all') {
            'made' => $query->where('status', 'done'),
            'needs' => $query->whereIn('status', ['confirm', 'followup']),
            'kept' => $query->where('status', 'kept'),
            default => $query,
        };
        $page = $query->orderByDesc('written_at')->orderByDesc('id')->cursorPaginate((int) ($input['limit'] ?? 20));
        $counts = Note::query()->selectRaw('status, count(*) as count')->groupBy('status')->pluck('count', 'status');

        return response()->json([
            'items' => $page->getCollection()->map(function (Note $note): array {
                $kinds = array_count_values(array_column($note->plan['changes'] ?? [], 'kind'));

                return ['id' => $note->id, 'status' => $note->status, 'name' => $note->name, 'excerpt' => mb_substr($note->text, 0, 140), 'written_at' => $note->written_at->format(DATE_ATOM), 'edited_at' => $note->edited_at?->format(DATE_ATOM), 'source_file_name' => $note->source_file_name, 'counts' => ['created' => $kinds['created'] ?? 0, 'updated' => $kinds['updated'] ?? 0, 'deleted' => $kinds['deleted'] ?? 0]];
            })->values(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'total' => (int) $counts->sum(),
            'needs_count' => (int) ($counts['confirm'] ?? 0) + (int) ($counts['followup'] ?? 0),
        ]);
    }

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

        return new NoteResultResource($process->replan($user, $note, $request->all()));
    }

    /** The user renames a note; its plan and tasks don't change. Edit note names it again (RV-5). */
    public function rename(Request $request, Note $note): NoteResultResource
    {
        $input = $request->validate(['name' => ['required', 'string', 'max:'.(int) config('notes.name_limit')]]);
        $note->forceFill(['name' => trim($input['name'])])->save();

        return new NoteResultResource($note);
    }

    public function apply(Request $request, Note $note, NoteConfirm $confirm): NoteResultResource
    {
        // Edits from Check this first, by entry ref: only the fields a task patch may set (TK §7).
        $input = $request->validate(['edits' => ['sometimes', 'array'], 'edits.*' => ['array:'.implode(',', Task::PATCHABLE)], 'exclude' => ['sometimes', 'array', 'max:30'], 'exclude.*' => ['string', 'distinct']]);

        return new NoteResultResource($confirm->apply($note, $input['edits'] ?? [], $input['exclude'] ?? []));
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
