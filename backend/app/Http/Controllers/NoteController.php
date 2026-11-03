<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ProcessNote;
use App\Http\Resources\NoteResultResource;
use App\Models\Note;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function show(Request $request, string $id): NoteResultResource
    {
        return new NoteResultResource(Note::query()->where('user_id', $request->user()?->id)->findOrFail($id));
    }

    public function clarify(Request $request, string $id, ProcessNote $process): NoteResultResource
    {
        $user = $request->user();
        assert($user instanceof User);
        $result = $process->handle($user, $request->all(), $id);

        return new NoteResultResource($result['note']);
    }

    public function store(Request $request, ProcessNote $process): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $result = $process->handle($user, $request->all());

        return (new NoteResultResource($result['note']))->response()->setStatusCode($result['replay'] ? 200 : 201);
    }
}
