<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\TaskResource;
use App\Services\Clock\ClockInterface;
use App\Services\Sync\SyncPatches;
use App\Services\Sync\SyncPull;
use Dedoc\Scramble\Attributes\BodyParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/** ADR-005: pull changes by cursor, push queued field patches (AP §7). */
class SyncController extends Controller
{
    public const MAX_BATCH = 500;

    /** @response array{changes: array{tasks: list<TaskResource>, projects: list<ProjectResource>, notes: list<array<string, mixed>>}, next_cursor: int, has_more: bool} */
    public function pull(Request $request, SyncPull $sync, ClockInterface $clock): JsonResponse
    {
        $input = $request->validate([
            'cursor' => ['sometimes', 'integer', 'min:0'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:'.self::MAX_BATCH],
            'full' => ['sometimes', 'boolean'],
        ]);
        $cursor = (int) ($input['cursor'] ?? 0);
        if (SyncPull::tooOld($cursor)) {
            throw new ApiError('sync.resync', 'Download everything again.', 410);
        }

        $limit = (int) ($input['limit'] ?? self::MAX_BATCH);
        $full = (bool) ($input['full'] ?? false);

        // #201: an idle device polls with the same cursor. Its ETag stands for the user's data
        // version, so an unchanged one answers 304 before any row is read
        $version = SyncPull::version();
        $timezone = (string) $request->attributes->get('timezone', 'UTC');
        $etag = md5(implode('|', ['sync', $version, $cursor, $limit, (int) $full, $clock->today($timezone)]));
        $response = new JsonResponse;
        $response->setEtag($etag, true);
        if ($response->isNotModified($request)) {
            return $response;
        }

        $page = $sync->pull($cursor, $limit, $full);
        // Only a caught-up page gets a tag: one that stopped before an unsettled row must be asked
        // again in full, or a 304 would hide that row once it commits
        if ($page['has_more'] || $page['next_cursor'] < $version) {
            $response->setEtag(null);
        }

        return $response->setData($page);
    }

    #[BodyParameter('*', 'The batch itself, a JSON array.', required: true, type: 'list<array{entity: "task"|"project", id: string, field: string, value: mixed, at: string}>')]
    public function patches(Request $request, SyncPatches $patches): JsonResponse
    {
        // The body is the batch itself: `[{entity, id, field, value, at}]`
        $batch = $request->json()->all();
        Validator::make(['patches' => $batch], [
            'patches' => ['required', 'list', 'max:'.self::MAX_BATCH],
            'patches.*.entity' => ['required', 'in:task,project'],
            'patches.*.id' => ['required', 'uuid'],
            'patches.*.field' => ['required', 'string', 'max:40'],
            'patches.*.value' => ['present'],
            'patches.*.at' => ['required', 'date'],
        ])->validate();

        /** @var list<array{entity: string, id: string, field: string, value: mixed, at: string}> $batch */
        return response()->json([
            'results' => $patches->apply($batch, ((string) $request->attributes->get('timezone')) ?: 'UTC'),
        ]);
    }
}
