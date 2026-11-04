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

        $overdue3 = $todayDt->modify('-3 days')->format('Y-m-d');
        $yesterday = $todayDt->modify('-1 day')->format('Y-m-d');
        $today = $todayStr;
        $day1 = $todayDt->modify('+1 day')->format('Y-m-d');
        $day2 = $todayDt->modify('+2 days')->format('Y-m-d');
        $day3 = $todayDt->modify('+3 days')->format('Y-m-d');
        $day6 = $todayDt->modify('+6 days')->format('Y-m-d');
        $day7 = $todayDt->modify('+7 days')->format('Y-m-d');
        $day10 = $todayDt->modify('+10 days')->format('Y-m-d');
        $day14 = $todayDt->modify('+14 days')->format('Y-m-d');

        $nowIso = $clock->now()->format('c');

        $tasks = [
            // ==========================================
            // Overdue Tasks
            // ==========================================
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
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Nộp báo cáo tiến độ tuần trước',
                'project_id' => $projects['Adv Web'],
                'start_date' => $overdue3,
                'due_date' => $overdue3,
                'priority' => 'medium',
                'notes' => 'Báo cáo chi tiết về tiến độ hoàn thành các module backend và frontend.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Pay electricity bill',
                'project_id' => null,
                'due_date' => $yesterday,
                'due_time' => '12:00:00',
                'reminder' => '1h',
                'priority' => 'high',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Today Open Tasks
            // ==========================================
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
                'notes' => 'Attach the normalized 3NF diagram and explain the foreign key constraints.',
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
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Họp nhóm đồ án Web Nâng Cao',
                'project_id' => $projects['Adv Web'],
                'start_date' => $today,
                'due_date' => $today,
                'start_time' => '14:00:00',
                'due_time' => '15:30:00',
                'reminder' => '15m',
                'priority' => 'high',
                'notes' => 'Thảo luận về REST API, full-text search và kế hoạch nộp đồ án.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Mua cà phê và chuối tươi',
                'project_id' => null,
                'due_date' => $today,
                'priority' => 'low',
                'created_by' => 'assistant',
                'notes' => 'Ghé siêu thị mua chuối chín (banana) và sữa chua không đường.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            // Start-only task (scheduled start time today, no deadline due_date)
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Read React 19 server components docs',
                'project_id' => $projects['Adv Web'],
                'start_date' => $today,
                'start_time' => '10:00:00',
                'due_date' => null,
                'priority' => 'medium',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Today Completed Tasks (Total: 6 -> tests >5 Show all toggle)
            // ==========================================
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
                'title' => 'Soạn bài tập SQL tuần 7',
                'project_id' => $projects['SQL Course'],
                'due_date' => $today,
                'done' => true,
                'done_at' => $nowIso,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Dọn dẹp bàn làm việc',
                'project_id' => $projects['Personal'],
                'due_date' => $today,
                'done' => true,
                'done_at' => $nowIso,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Backup database PostgreSQL',
                'project_id' => $projects['Adv Web'],
                'due_date' => $today,
                'done' => true,
                'done_at' => $nowIso,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Kiểm tra email đối tác',
                'project_id' => null,
                'due_date' => $today,
                'done' => true,
                'done_at' => $nowIso,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Water the indoor plants',
                'project_id' => $projects['Personal'],
                'due_date' => $today,
                'repeat' => 'daily',
                'done' => true,
                'done_at' => $nowIso,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // No Date Tasks (Inbox "No date" section)
            // ==========================================
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Tìm tài liệu tham khảo UI/UX cho portfolio',
                'project_id' => $projects['Portfolio'],
                'priority' => 'medium',
                'notes' => 'Xem thiết kế trên Dribbble, Behance và Mobbin để lấy cảm hứng layout.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Research PostgreSQL unaccent with pg_trgm',
                'project_id' => $projects['Adv Web'],
                'priority' => 'high',
                'notes' => 'Check GIN index performance on large datasets and query planning.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Learn Rust programming language basics',
                'project_id' => null,
                'priority' => 'low',
                'notes' => 'Borrow checker, lifetimes, and pattern matching syntax.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Đổi mật khẩu định kỳ tài khoản ngân hàng',
                'project_id' => $projects['Personal'],
                'priority' => 'high',
                'reminder' => 'none',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Brainstorm ý tưởng đề tài khóa luận',
                'project_id' => $projects['SQL Course'],
                'priority' => 'medium',
                'notes' => 'Hệ thống cơ sở dữ liệu phân tán hoặc công cụ hỗ trợ truy vấn thông minh.',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Upcoming Day 1 (Tomorrow)
            // ==========================================
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
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Chuẩn bị câu hỏi phỏng vấn thực tập sinh',
                'project_id' => $projects['Portfolio'],
                'start_date' => $day1,
                'due_date' => $day1,
                'start_time' => '10:00:00',
                'due_time' => '11:30:00',
                'priority' => 'high',
                'reminder' => '30m',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Upcoming Day 2
            // ==========================================
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
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Khám sức khỏe định kỳ',
                'project_id' => $projects['Personal'],
                'start_date' => $day2,
                'due_date' => $day2,
                'start_time' => '08:30:00',
                'reminder' => '1d',
                'priority' => 'medium',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Upcoming Day 3
            // ==========================================
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

            // ==========================================
            // Upcoming Day 6
            // ==========================================
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

            // ==========================================
            // Upcoming Day 7 (Monthly recurring task)
            // ==========================================
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Monthly sprint retrospective',
                'project_id' => $projects['Adv Web'],
                'start_date' => $day7,
                'due_date' => $day7,
                'start_time' => '15:00:00',
                'repeat' => 'monthly',
                'reminder' => '1h',
                'priority' => 'medium',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Upcoming Day 10 (Yearly recurring task & CV)
            // ==========================================
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Update CV and portfolio links',
                'project_id' => $projects['Portfolio'],
                'due_date' => $day10,
                'priority' => 'medium',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Kỷ niệm thành lập nhóm nghiên cứu',
                'project_id' => $projects['Personal'],
                'due_date' => $day10,
                'repeat' => 'yearly',
                'priority' => 'low',
                'done' => false,
                'created_at' => $nowIso,
                'updated_at' => $nowIso,
            ],

            // ==========================================
            // Upcoming Day 14 (Final Milestone)
            // ==========================================
            [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => 'Final project demo presentation',
                'project_id' => $projects['Adv Web'],
                'start_date' => $day14,
                'due_date' => $day14,
                'start_time' => '08:00:00',
                'due_time' => '11:00:00',
                'reminder' => '1d',
                'priority' => 'high',
                'notes' => 'Chuẩn bị slide thuyết trình và chạy live demo cho hội đồng chấm đồ án.',
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
