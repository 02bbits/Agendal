<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Note;
use App\Services\Projects\ProjectCounts;
use App\Services\Tasks\InboxQuery;
use App\Services\Tasks\UpcomingQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * `GET /counts`: the sidebar's numbers in one call, by the same rules as the lists they stand for
 * (Inbox overdue + today, Upcoming's default 14 days, open tasks in no project, all notes).
 */
class CountsController extends Controller
{
    public function __invoke(Request $request, InboxQuery $inbox, UpcomingQuery $upcoming, ProjectCounts $projectCounts): JsonResponse
    {
        $timezone = (string) $request->attributes->get('timezone', 'UTC');

        return response()->json([
            'inbox' => $inbox->countFor($timezone),
            'upcoming' => $upcoming->countFor($timezone),
            'no_project' => $projectCounts->withoutProject()['open'],
            'notes' => Note::statusCounts()->sum(),
        ]);
    }
}
