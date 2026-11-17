<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Note;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Support\NewPassword;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use RuntimeException;

class E2eSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('E2E_PASSWORD');
        if (empty($password)) {
            if (! app()->environment('local', 'testing')) {
                throw new RuntimeException('E2E_PASSWORD must be set in non-local environments.');
            }
            $password = 'E2e quiet river 42';
        }

        if (NewPassword::strength($password) < 3) {
            throw new InvalidArgumentException('E2E_PASSWORD must have Good+ strength.');
        }

        Cache::flush();

        $hashedPassword = Hash::make($password);
        $now = now();

        for ($i = 1; $i <= 80; $i++) {
            $num = sprintf('%02d', $i);
            $email = "e2e-{$num}@example.test";
            $displayName = "E2E User {$num}";

            $existing = User::where('email', $email)->first();
            if ($existing !== null) {
                DB::table('sessions')->where('user_id', $existing->id)->delete();
                DB::table('email_verification_codes')->where('user_id', $existing->id)->delete();
                DB::table('push_subscriptions')->where('user_id', $existing->id)->delete();
                Task::withoutGlobalScope('owner')->where('user_id', $existing->id)->forceDelete();
                Project::withoutGlobalScope('owner')->where('user_id', $existing->id)->forceDelete();
                Note::withoutGlobalScope('owner')->where('user_id', $existing->id)->forceDelete();
                $existing->delete();
            }
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            $user = new User;
            $user->forceFill([
                'email' => $email,
                'display_name' => $displayName,
                'password' => $hashedPassword,
                'email_verified_at' => $now,
                'install_prompt_shown' => true,
                'timezone' => 'Asia/Ho_Chi_Minh',
                'timezone_auto' => false,
                'two_factor_enabled' => false,
                'remember_device' => true,
                'theme' => 'system',
                'week_start' => 'mon',
                'time_format' => '24h',
            ]);
            $user->save();
        }
    }
}
