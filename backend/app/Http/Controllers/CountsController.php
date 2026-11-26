<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Note;
use App\Services\Clock\ClockInterface;
use App\Services\Projects\ProjectCounts;
use App\Services\Sync\SyncPull;
use App\Services\Tasks\InboxQuery;
use App\Services\Tasks\UpcomingQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * `GET /counts`: the sidebar's numbers in one call, by the same rules as the lists they stand for
 * (Inbox overdue + today, Upcoming's default 14 days, open tasks in no project, all notes).
 * They change only with the user's data or the local date, so a matching ETag answers 304 before
 * any list query runs (#201).
 */
class CountsController extends Controller
{
    public function __invoke(Request $request, InboxQuery $inbox, UpcomingQuery $upcoming, ProjectCounts $projectCounts, ClockInterface $clock): JsonResponse
    {
        $timezone = (string) $request->attributes->get('timezone', 'UTC');
        $response = new JsonResponse;
        $response->setEtag(md5(implode('|', ['counts', SyncPull::version(), $timezone, $clock->today($timezone)])), true);
        if ($response->isNotModified($request)) {
            return $response;
        }
        $lists = $inbox->for($timezone);

        return $response->setData([
            'inbox' => count($lists['overdue']) + count($lists['today']),
            'upcoming' => $upcoming->for($timezone)['total_count'],
            'no_project' => $projectCounts->withoutProject()['open'],
            'notes' => Note::statusCounts()->sum(),
        ]);
    }
}
