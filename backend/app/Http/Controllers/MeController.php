<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Clock\UserTimezone;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// AP-3, AP-5: the signed-in user and the settings every device follows
class MeController extends Controller
{
    public function __construct(
        private UserTimezone $userTimezone,
    ) {}

    public function show(Request $request): User
    {
        return $this->user($request);
    }

    public function update(Request $request): User
    {
        $user = $this->user($request);
        $data = $request->validate([
            'display_name' => ['sometimes', 'string', 'max:60'],
            'theme' => ['sometimes', Rule::in(['system', 'light', 'dark'])],
            'week_start' => ['sometimes', Rule::in(['mon', 'sun'])],
            'time_format' => ['sometimes', Rule::in(['24h', '12h'])],
            'remember_device' => ['sometimes', 'boolean'],
            'install_prompt_shown' => ['sometimes', 'boolean'],
            'timezone' => ['sometimes', 'string', Rule::in(DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC))],
            'timezone_auto' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('timezone_auto', $data) && $data['timezone_auto'] === true) {
            unset($data['timezone']);
            $data['timezone_auto'] = true;
            $headerZone = $request->header('X-Timezone');
            if (is_string($headerZone) && in_array($headerZone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
                $this->userTimezone->change($user, $headerZone);
            }
        } elseif (array_key_exists('timezone', $data)) {
            $data['timezone_auto'] = false;
            $targetZone = $data['timezone'];
            unset($data['timezone']);
            $this->userTimezone->change($user, $targetZone);
        }

        $user->update($data);

        return $user;
    }

    private function user(Request $request): User
    {
        /** @var User */
        return $request->user();
    }
}
