<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

// AA-5: sign out. The client wipes its own data (SC-19); this ends the session on the server.
class LogoutController extends Controller
{
    // Answers 204 even when the session already ended, so the client can always finish signing out
    public function __invoke(Request $request): Response
    {
        abort_unless($request->hasSession(), 403);
        // This device only: logout() would also end Remember me on every other device
        Auth::guard('web')->logoutCurrentDevice();

        return $this->endSession($request);
    }

    // Ends every session, this one and Remember me included (AA §2.4, T-AA-43)
    public function everywhere(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        DB::table('sessions')->where('user_id', $user->id)->delete();
        Auth::guard('web')->logout(); // Also replaces the Remember me token
        DB::table('audit_events')->insert([
            'user_id' => $user->id, 'event' => 'sign_out_everywhere', 'ip' => $request->ip(), 'user_agent' => $request->userAgent(),
        ]);

        return $this->endSession($request);
    }

    private function endSession(Request $request): Response
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
