<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * The demo account used across the docs (test strategy: test data).
     */
    public function run(ClockInterface $clock): void
    {
        $user = User::firstOrCreate(
            ['email' => 'example@gmail.com'],
            [
                'display_name' => 'example',
                'password' => 'password',
            ]
        );

        // Colours from the theme guide's project examples
        $projectDefs = [
            'SQL Course' => 'blue',
            'Adv Web' => 'red',
            'HCI' => 'orange',
            'Portfolio' => 'green',
            'Personal' => 'purple',
        ];

        $projects = [];
        foreach ($projectDefs as $name => $colour) {
            $p = Project::withoutGlobalScope('owner')->firstOrCreate(
                ['user_id' => $user->id, 'name' => $name],
                [
                    'id' => (string) Str::uuid7(),
                    'colour' => $colour,
                    'created_at' => $clock->now(),
                    'updated_at' => $clock->now(),
                ]
            );
            $projects[$name] = $p->id;
        }

        // Clean up previous tasks for example user to allow fresh idempotent seed
        Task::withoutGlobalScope('owner')->where('user_id', $user->id)->forceDelete();

        $todayStr = $clock->today('Asia/Ho_Chi_Minh');
        $todayDt = new DateTimeImmutable($todayStr);

        $yesterday = $todayDt->modify('-1 day')->format('Y-m-d');
        $today = $todayStr;
        $day1 = $todayDt->modify('+1 day')->format('Y-m-d');
        $day2 = $todayDt->modify('+2 days')->format('Y-m-d');
        $day3 = $todayDt->modify('+3 days')->format('Y-m-d');
        $day6 = $todayDt->modify('+6 days')->format('Y-m-d');
        $day10 = $todayDt->modify('+10 days')->format('Y-m-d');

        $nowIso = $clock->now()->format('c');

        $tasks = [
            // Overdue
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Submit HCI reflection',
                'project_id' => $projects['HCI'],
                'start_date' => $yesterday,
                'due_date' => $yesterday,
                'start_time' => '23:59:00',
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Today
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Morning run',
                'project_id' => $projects['Personal'],
                'start_date' => $today,
                'due_date' => $today,
                'start_time' => '07:00:00',
                'repeat' => 'daily',
                'done' => true,
                'done_at' => $nowIso,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Review lecture 6 notes',
                'project_id' => $projects['HCI'],
                'start_date' => $today,
                'due_date' => $today,
                'start_time' => '16:00:00',
                'due_time' => '17:00:00',
                'reminder' => '15m',
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Email the group about the ER diagram',
                'project_id' => $projects['SQL Course'],
                'start_date' => $today,
                'due_date' => $today,
                'start_time' => '20:00:00',
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Renew gym membership',
                'project_id' => $projects['Personal'],
                'due_date' => $today,
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Upcoming Day 1 (Tomorrow)
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Adv Web report: outline',
                'project_id' => $projects['Adv Web'],
                'start_date' => $day1,
                'due_date' => $day1,
                'start_time' => '09:00:00',
                'due_time' => '10:00:00',
                'reminder' => '15m',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Buy printer ink',
                'project_id' => null,
                'due_date' => $day1,
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Upcoming Day 2
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Team sync for SQL project',
                'project_id' => $projects['SQL Course'],
                'start_date' => $day2,
                'due_date' => $day2,
                'start_time' => '14:00:00',
                'due_time' => '15:00:00',
                'reminder' => '15m',
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'HCI wireframe review',
                'project_id' => $projects['HCI'],
                'start_date' => $day2,
                'due_date' => $day2,
                'start_time' => '14:00:00',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Upcoming Day 3
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Renew gym membership',
                'project_id' => $projects['Personal'],
                'due_date' => $day3,
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Submit Adv Web report',
                'project_id' => $projects['Adv Web'],
                'due_date' => $day3,
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Weekly review',
                'project_id' => $projects['Personal'],
                'start_date' => $day3,
                'due_date' => $day3,
                'start_time' => '17:00:00',
                'repeat' => 'weekly',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Upcoming Day 4
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'SQL quiz',
                'project_id' => $projects['SQL Course'],
                'start_date' => $day6,
                'due_date' => $day6,
                'start_time' => '09:00:00',
                'reminder' => '1h',
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Upcoming Day 5 (Later)
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Update CV',
                'project_id' => $projects['Portfolio'],
                'due_date' => $day10,
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
        ];

        foreach ($tasks as $taskData) {
            Task::withoutGlobalScope('owner')->create($taskData);
        }
    }
}
