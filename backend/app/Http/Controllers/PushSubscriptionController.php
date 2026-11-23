<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Http\Requests\StorePushSubscriptionRequest;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\Push\PushSending;
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

    /**
     * Settings > Notifications: a test push to this device (the endpoint the browser sends), or
     * to every device of the account without one. It goes the same way reminders do and answers
     * at once with how it went. Rate-limited, so it can't be used to flood a device.
     */
    public function test(Request $request, VapidKeys $keys, PushSending $pushes): JsonResponse
    {
        if (! $keys->configured()) {
            throw new ApiError('push.not_configured', __('push.not_configured'), 503);
        }
        /** @var User $user */
        $user = $request->user();
        $endpoint = $request->input('endpoint');
        $devices = PushSubscription::query()->where('user_id', $user->id)
            ->when(is_string($endpoint), fn ($q) => $q->where('endpoint', $endpoint))
            ->get();
        if ($devices->isEmpty()) {
            throw new ApiError('push.no_devices', __('push.no_devices'), 409);
        }
        $payload = (string) json_encode([
            'title' => __('push.test_title'),
            'body' => __('push.test_body'),
            'url' => '/',
            'tag' => 'agendal-test',
        ]);
        $outgoing = [];
        foreach ($devices as $device) {
            $outgoing[] = ['device' => $device, 'payload' => $payload, 'options' => ['TTL' => 60, 'urgency' => 'high', 'topic' => 'agendal-test']];
        }
        $outcomes = $pushes->send($outgoing);
        $counts = array_count_values($outcomes);

        return response()->json([
            'sent' => $counts[PushSending::SENT] ?? 0,
            'gone' => $counts[PushSending::GONE] ?? 0,
            'failed' => ($counts[PushSending::TEMPORARY] ?? 0) + ($counts[PushSending::REFUSED] ?? 0),
        ]);
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
