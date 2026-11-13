<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Services\Sync\SyncPatches;
use App\Services\Sync\SyncPull;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/** ADR-005: pull changes by cursor, push queued field patches (AP §7). */
class SyncController extends Controller
{
    public const MAX_BATCH = 500;

    public function pull(Request $request, SyncPull $sync): JsonResponse
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

        return response()->json($sync->pull($cursor, (int) ($input['limit'] ?? self::MAX_BATCH), (bool) ($input['full'] ?? false)));
    }

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
