<?php

declare(strict_types=1);

namespace Tests\Performance;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('PERF-05: list performance with 5000 tasks (p95 <= 300ms)', function () {
    // OpenTaskLimit is 5000. We create exactly 5000 tasks: 2500 open, 2500 done.
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);

    $projectRecords = [];
    for ($p = 0; $p < 20; $p++) {
        $projectRecords[] = [
            'id' => (string) Str::uuid7(),
            'user_id' => $user->id,
            'name' => "Dự án {$p}",
            'colour' => 'blue',
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
    DB::table('projects')->insert($projectRecords);
    $projectIds = array_column($projectRecords, 'id');

    $vietnameseWords = [
        'Bài tập', 'Họp nhóm', 'Báo cáo', 'Đọc sách', 'Làm đồ án',
        'Kế hoạch', 'Nghiên cứu', 'Thảo luận', 'Thiết kế', 'Kiểm thử',
    ];

    $today = Carbon::today('Asia/Ho_Chi_Minh');

    $taskRecords = [];
    $totalTasks = 5000;
    $openLimit = 2500;

    for ($i = 0; $i < $totalTasks; $i++) {
        $isOpen = $i < $openLimit;
        $dayOffset = ($i % 91) - 30; // -30 to +60
        $date = $today->copy()->addDays($dayOffset)->toDateString();

        $dateMode = $i % 4;
        $startDate = null;
        $dueDate = null;

        if ($dateMode === 0) {
            $startDate = $date;
        } elseif ($dateMode === 1) {
            $dueDate = $date;
        } elseif ($dateMode === 2) {
            $startDate = $date;
            $dueDate = $today->copy()->addDays($dayOffset + ($i % 5))->toDateString();
        }

        $repeat = ($i % 10 === 0) ? 'weekly' : 'never';
        $projectId = ($i % 5 === 0) ? null : $projectIds[$i % 20];
        $word = $vietnameseWords[$i % count($vietnameseWords)];
        $title = "{$word} số ".($i + 1);

        $taskRecords[] = [
            'id' => (string) Str::uuid7(),
            'user_id' => $user->id,
            'project_id' => $projectId,
            'title' => $title,
            'start_date' => $startDate,
            'due_date' => $dueDate,
            'start_time' => null,
            'due_time' => null,
            'priority' => null,
            'reminder' => 'none',
            'repeat' => $repeat,
            'notes' => null,
            'done' => ! $isOpen,
            'done_at' => $isOpen ? null : now(),
            'created_by' => 'user',
            'source_note_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'field_updated_at' => json_encode([]),
        ];
    }

    foreach (array_chunk($taskRecords, 500) as $chunk) {
        DB::table('tasks')->insert($chunk);
    }

    $endpoints = [
        'inbox' => '/api/v1/tasks?view=inbox',
        'upcoming' => '/api/v1/tasks?view=upcoming',
        'search' => '/api/v1/tasks/search?q='.urlencode('Báo cáo'),
    ];

    try {
        foreach ($endpoints as $name => $uri) {
            for ($w = 0; $w < 3; $w++) {
                $this->actingAs($user)->getJson($uri)->assertStatus(200);
            }

            $times = [];
            for ($t = 0; $t < 30; $t++) {
                $start = hrtime(true);
                $res = $this->actingAs($user)->getJson($uri);
                $elapsedMs = (hrtime(true) - $start) / 1_000_000;
                $res->assertStatus(200);
                $times[] = $elapsedMs;
            }

            sort($times);
            $p50 = $times[14];
            $p95 = $times[28];
            $max = $times[29];

            fwrite(STDOUT, sprintf("%s: p50=%.2fms, p95=%.2fms, max=%.2fms\n", $name, $p50, $p95, $max));

            expect($p95)->toBeLessThanOrEqual(300.0);
        }
    } finally {
        DB::table('tasks')->where('user_id', $user->id)->delete();
        DB::table('projects')->where('user_id', $user->id)->delete();
        $user->delete();
    }
});
