<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\SearchNotesRequest;
use App\Services\Search\NoteSearch;
use Illuminate\Http\JsonResponse;

class NoteSearchController extends Controller
{
    public function __invoke(SearchNotesRequest $request, NoteSearch $noteSearch): JsonResponse
    {
        $user = $request->user();
        assert($user !== null);

        $q = (string) $request->query('q', $request->input('q', ''));

        return response()->json($noteSearch->search($user->id, $q));
    }
}
