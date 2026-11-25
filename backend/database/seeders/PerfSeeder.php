<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Project;
use App\Models\User;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeds isolated users and a 5,000-task heavy account for IM-63 / PERF-05 load tests.
 */
class PerfSeeder extends Seeder
{
    public const HEAVY_EMAIL = 'perf-heavy@agendal.test';

    public const POOL_SIZE = 10;

    public const HEAVY_TASK_COUNT = 5000;

    public const HEAVY_NOTE_COUNT = 50;

    public function run(): void
    {
        $now = now('UTC');
        $nowStr = $now->toDateTimeString();

        for ($i = 1; $i <= self::POOL_SIZE; $i++) {
            $user = User::firstOrCreate(
                ['email' => "perf{$i}@agendal.test"],
                [
                    'display_name' => "perf{$i}",
                    'password' => 'password',
                    'email_verified_at' => $now,
                ]
            );
            $this->ensureProjects($user, $nowStr);
        }

        $heavy = User::firstOrCreate(
            ['email' => self::HEAVY_EMAIL],
            [
                'display_name' => 'perf-heavy',
                'password' => 'password',
                'email_verified_at' => $now,
            ]
        );
        $projectIds = $this->ensureProjects($heavy, $nowStr);

        $existingTasks = DB::table('tasks')->where('user_id', $heavy->id)->count();
        if ($existingTasks < self::HEAVY_TASK_COUNT) {
            $this->seedHeavyTasks($heavy->id, $projectIds, self::HEAVY_TASK_COUNT - $existingTasks, $now, $nowStr);
        }

        $existingNotes = DB::table('notes')->where('user_id', $heavy->id)->count();
        if ($existingNotes < self::HEAVY_NOTE_COUNT) {
            $this->seedHeavyNotes($heavy->id, self::HEAVY_NOTE_COUNT - $existingNotes, $now, $nowStr);
        }
    }

    /**
     * @return list<string>
     */
    private function ensureProjects(User $user, string $nowStr): array
    {
        $defs = [
            'SQL Course' => 'blue',
            'Adv Web' => 'red',
            'HCI' => 'orange',
            'Portfolio' => 'green',
            'Personal' => 'purple',
        ];
        $ids = [];
        foreach ($defs as $name => $colour) {
            $existing = Project::withoutGlobalScope('owner')
                ->where('user_id', $user->id)
                ->where('name', $name)
                ->first();
            if ($existing === null) {
                $id = (string) Str::uuid7();
                DB::table('projects')->insert([
                    'id' => $id,
                    'user_id' => $user->id,
                    'name' => $name,
                    'colour' => $colour,
                    'created_at' => $nowStr,
                    'updated_at' => $nowStr,
                    'field_updated_at' => '{}',
                ]);
                $ids[] = $id;
            } else {
                $ids[] = (string) $existing->id;
            }
        }

        return $ids;
    }

    /**
     * @param  list<string>  $projectIds
     */
    private function seedHeavyTasks(int $userId, array $projectIds, int $count, DateTimeInterface $now, string $nowStr): void
    {
        $topics = [
            'Prepare quarterly report',
            'Review lecture notes',
            'Submit team assignment',
            'Buy groceries and coffee',
            'Họp nhóm đồ án Web Nâng Cao',
            'Nộp báo cáo tiến độ tuần',
            'Refactor database search index',
            'Verify mobile layout accessibility',
        ];
        $priorities = [null, 'low', 'medium', 'high'];
        $rows = [];
        $today = CarbonImmutable::instance($now);

        for ($i = 0; $i < $count; $i++) {
            $done = ($i % 5) === 0;
            $offsetDays = ($i % 21) - 5;
            $dueDate = ($i % 4 === 3) ? null : $today->addDays($offsetDays)->format('Y-m-d');
            $rows[] = [
                'id' => (string) Str::uuid7(),
                'user_id' => $userId,
                'project_id' => $projectIds[$i % count($projectIds)],
                'title' => $topics[$i % count($topics)]." #{$i}",
                'due_date' => $dueDate,
                'start_date' => ($i % 6 === 0 && $dueDate !== null) ? $today->addDays($offsetDays - 1)->format('Y-m-d') : null,
                'priority' => $priorities[$i % count($priorities)],
                'reminder' => 'none',
                'repeat' => 'never',
                'notes' => ($i % 3 === 0) ? "Detailed checklist and notes for task #{$i} covering API latency and search." : null,
                'done' => $done,
                'done_at' => $done ? $nowStr : null,
                'created_by' => 'user',
                'created_at' => $nowStr,
                'updated_at' => $nowStr,
                'field_updated_at' => '{}',
            ];

            if (count($rows) === 500) {
                DB::table('tasks')->insert($rows);
                $rows = [];
            }
        }

        if ($rows !== []) {
            DB::table('tasks')->insert($rows);
        }
    }

    private function seedHeavyNotes(int $userId, int $count, DateTimeInterface $now, string $nowStr): void
    {
        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid7(),
                'user_id' => $userId,
                'client_id' => (string) Str::uuid7(),
                'text' => "Team meeting recap #{$i}: finalize report draft and sync with backend tomorrow morning",
                'name' => "Meeting recap #{$i}",
                'status' => 'done',
                'plan' => json_encode(['changes' => [], 'skipped' => [], 'ambiguous' => [], 'dropped' => 0]),
                'applied' => '[]',
                'engine' => 'rules',
                'written_at' => CarbonImmutable::instance($now)->subHours($i)->toDateTimeString(),
                'written_tz' => 'Asia/Ho_Chi_Minh',
                'created_at' => $nowStr,
                'processed_at' => $nowStr,
            ];
        }
        if ($rows !== []) {
            DB::table('notes')->insert($rows);
        }
    }
}
