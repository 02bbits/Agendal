<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StorePushSubscriptionRequest;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PushSubscriptionController extends Controller
{
    public function key(): JsonResponse
    {
        return response()->json([
            'key' => config('services.webpush.public_key'),
        ]);
    }

    public function store(StorePushSubscriptionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();
        assert($user !== null);

        PushSubscription::withoutGlobalScope('owner')->updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'user_id' => $user->id,
                'keys' => [
                    'p256dh' => $validated['keys']['p256dh'],
                    'auth' => $validated['keys']['auth'],
                ],
            ]
        );

        return response()->json((object) [], 201);
    }

    public function destroy(Request $request): Response
    {
        $endpoint = $request->input('endpoint');
        $user = $request->user();
        assert($user !== null);
        if (is_string($endpoint) && $endpoint !== '') {
            PushSubscription::query()
                ->where('user_id', $user->id)
                ->where('endpoint', $endpoint)
                ->delete();
        }

        return response()->noContent();
    }
}
