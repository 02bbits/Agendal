<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StorePushSubscriptionRequest;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\Push\VapidKeys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Devices that get reminders (TK-6, TK §2.5, api.md). Every call needs the signed-in user, and a
 * subscription always belongs to that user (SC-18).
 */
class PushSubscriptionController extends Controller
{
    /** The public key the browser subscribes with; null when reminders aren't set up. */
    public function key(VapidKeys $keys): JsonResponse
    {
        return response()->json(['public_key' => $keys->configured() ? $keys->publicKey() : null]);
    }

    /**
     * Saves this device's subscription. An endpoint another account had (same browser, new
     * sign-in) moves to this user, so the old account stops getting this device's reminders.
     */
    public function store(StorePushSubscriptionRequest $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        /** @var array{p256dh: string, auth: string} $keys */
        $keys = $request->validated('keys');
        PushSubscription::query()->updateOrCreate(
            ['endpoint' => (string) $request->validated('endpoint')],
            ['user_id' => $user->id, 'keys' => ['p256dh' => $keys['p256dh'], 'auth' => $keys['auth']]],
        );

        return response()->noContent(201);
    }

    /** Removes this device's subscription (sign-out, or permission turned off). Always 204. */
    public function destroy(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $endpoint = $request->input('endpoint');
        if (is_string($endpoint)) {
            PushSubscription::query()->where('user_id', $user->id)->where('endpoint', $endpoint)->delete();
        }

        return response()->noContent();
    }
}
