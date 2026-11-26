<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessNote;
use App\Enums\PlanStatus;
use App\Http\Resources\NoteResultResource;
use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Notes\NoteConfirm;
use App\Services\Notes\NoteFollowup;
use App\Services\Notes\NoteUndo;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Response as DocsResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class NoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['filter' => ['sometimes', 'in:all,made,needs'], 'cursor' => ['nullable', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $query = Note::query();
        match ($input['filter'] ?? 'all') {
            'made' => $query->where('status', PlanStatus::Done->value),
            'needs' => $query->whereIn('status', PlanStatus::needsLook()),
            default => $query,
        };
        $page = $query->orderByDesc('written_at')->orderByDesc('id')->cursorPaginate((int) ($input['limit'] ?? 20));
        $counts = Note::statusCounts();

        return response()->json([
            'items' => $page->getCollection()->map(fn (Note $note): array => $note->listRow())->values(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'total' => $counts->sum(),
            'needs_count' => $counts->only(PlanStatus::needsLook())->sum(),
        ]);
    }

    // ProcessNote validates the body, out of Scramble's sight
    #[BodyParameter('client_id', 'Client-generated UUID v4; a retry with the same one returns the stored note.', required: true, type: 'string', format: 'uuid')]
    #[BodyParameter('text', required: true, type: 'string')]
    #[BodyParameter('written_at', 'ISO 8601 with offset; clamped to server time.', required: true, type: 'string', format: 'date-time')]
    #[BodyParameter('timezone', 'IANA zone.', required: true, type: 'string')]
    #[BodyParameter('source_file_name', required: false, type: 'string|null')]
    #[DocsResponse(201, 'The new note and its plan.', type: NoteResultResource::class)]
    #[DocsResponse(200, 'A replay: the note already stored for this client_id.', type: NoteResultResource::class)]
    #[DocsResponse(422, 'Invalid body, or the note itself: `note.empty`, `note.too_long`, `note.too_many_items`.')]
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

    #[BodyParameter('text', required: true, type: 'string')]
    #[BodyParameter('timezone', 'IANA zone.', required: true, type: 'string')]
    #[BodyParameter('confirm_conflicts', required: false, type: 'bool')]
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
        $input = $request->validate(['edits' => ['sometimes', 'array'], 'edits.*' => ['array:'.implode(',', Task::PATCHABLE)], 'exclude' => ['sometimes', 'array', 'max:30'], 'exclude.*' => ['string', 'distinct'], 'plan_version' => ['sometimes', 'integer', 'min:1']]);

        return new NoteResultResource($confirm->apply($note, $input['edits'] ?? [], $input['exclude'] ?? [], isset($input['plan_version']) ? (int) $input['plan_version'] : null));
    }

    public function undo(Request $request, Note $note, NoteUndo $undo): NoteResultResource
    {
        return new NoteResultResource($undo->undo($note, $request->boolean('confirm_conflicts')));
    }

    public function redo(Note $note, NoteUndo $undo): NoteResultResource
    {
        return new NoteResultResource($undo->redo($note));
    }

    public function destroy(Note $note): Response
    {
        $note->delete();

        return response()->noContent();
    }

    /** Undo of Delete note (RV §2.7); a note that is not deleted comes back unchanged. */
    public function restore(Note $note): NoteResultResource
    {
        $note->restore();

        return new NoteResultResource($note);
    }
}
