<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// AP-3, AP-5: the signed-in user and the settings every device follows
class MeController extends Controller
{
    public function show(Request $request): User
    {
        return $this->user($request);
    }

    public function update(Request $request): User
    {
        $user = $this->user($request);
        $user->update($request->validate([
            'display_name' => ['sometimes', 'string', 'max:60'],
            'theme' => ['sometimes', Rule::in(['system', 'light', 'dark'])],
            'week_start' => ['sometimes', Rule::in(['mon', 'sun'])],
            'time_format' => ['sometimes', Rule::in(['24h', '12h'])],
            'remember_device' => ['sometimes', 'boolean'],
            'install_prompt_shown' => ['sometimes', 'boolean'],
        ]));

        return $user;
    }

    private function user(Request $request): User
    {
        /** @var User */
        return $request->user();
    }
}
