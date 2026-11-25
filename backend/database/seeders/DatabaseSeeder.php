<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Support\Stamp;
use DateTimeImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    // Colours from the theme guide's project examples
    private const PROJECTS = [
        'SQL Course' => 'blue',
        'Adv Web' => 'red',
        'HCI' => 'orange',
        'Portfolio' => 'green',
        'Personal' => 'purple',
    ];

    /**
     * The demo tasks. `start` and `due` are days from today in the demo user's timezone; `project`
     * names one of PROJECTS; the rest are task columns.
     *
     * @var list<array<string, mixed>>
     */
    private const TASKS = [
        // Overdue
        ['title' => 'Submit HCI reflection', 'project' => 'HCI', 'start' => -1, 'due' => -1, 'start_time' => '23:59', 'priority' => 'high'],
        ['title' => 'Nộp báo cáo tiến độ tuần trước', 'project' => 'Adv Web', 'start' => -3, 'due' => -3, 'priority' => 'medium', 'notes' => 'Báo cáo chi tiết về tiến độ hoàn thành các module backend và frontend.'],
        ['title' => 'Pay electricity bill', 'due' => -1, 'due_time' => '12:00', 'reminder' => '1h', 'priority' => 'high'],

        // Today, open
        ['title' => 'Review lecture 6 notes', 'project' => 'HCI', 'start' => 0, 'due' => 0, 'start_time' => '16:00', 'due_time' => '17:00', 'reminder' => '15m', 'priority' => 'high'],
        ['title' => 'Email the group about the ER diagram', 'project' => 'SQL Course', 'start' => 0, 'due' => 0, 'start_time' => '20:00', 'priority' => 'high', 'notes' => 'Attach the normalized 3NF diagram and explain the foreign key constraints.'],
        ['title' => 'Renew gym membership', 'project' => 'Personal', 'due' => 0],
        ['title' => 'Họp nhóm đồ án Web Nâng Cao', 'project' => 'Adv Web', 'start' => 0, 'due' => 0, 'start_time' => '14:00', 'due_time' => '15:30', 'reminder' => '15m', 'priority' => 'high', 'notes' => 'Thảo luận về REST API, full-text search và kế hoạch nộp đồ án.'],
        ['title' => 'Mua cà phê và chuối tươi', 'due' => 0, 'priority' => 'low', 'created_by' => 'assistant', 'notes' => 'Ghé siêu thị mua chuối chín (banana) và sữa chua không đường.'],
        // Start only: a start time today, no due date
        ['title' => 'Read React 19 server components docs', 'project' => 'Adv Web', 'start' => 0, 'start_time' => '10:00', 'priority' => 'medium'],

        // Today, done: six, so the Done list shows its "Show all" toggle (more than five)
        ['title' => 'Morning run', 'project' => 'Personal', 'start' => 0, 'due' => 0, 'start_time' => '07:00', 'repeat' => 'daily', 'done' => true],
        ['title' => 'Soạn bài tập SQL tuần 7', 'project' => 'SQL Course', 'due' => 0, 'done' => true],
        ['title' => 'Dọn dẹp bàn làm việc', 'project' => 'Personal', 'due' => 0, 'done' => true],
        ['title' => 'Backup database PostgreSQL', 'project' => 'Adv Web', 'due' => 0, 'done' => true],
        ['title' => 'Kiểm tra email đối tác', 'due' => 0, 'done' => true],
        ['title' => 'Water the indoor plants', 'project' => 'Personal', 'due' => 0, 'repeat' => 'daily', 'done' => true],

        // No date (Inbox "No date")
        ['title' => 'Tìm tài liệu tham khảo UI/UX cho portfolio', 'project' => 'Portfolio', 'priority' => 'medium', 'notes' => 'Xem thiết kế trên Dribbble, Behance và Mobbin để lấy cảm hứng layout.'],
        ['title' => 'Research PostgreSQL unaccent with pg_trgm', 'project' => 'Adv Web', 'priority' => 'high', 'notes' => 'Check GIN index performance on large datasets and query planning.'],
        ['title' => 'Learn Rust programming language basics', 'priority' => 'low', 'notes' => 'Borrow checker, lifetimes, and pattern matching syntax.'],
        ['title' => 'Đổi mật khẩu định kỳ tài khoản ngân hàng', 'project' => 'Personal', 'priority' => 'high'],
        ['title' => 'Brainstorm ý tưởng đề tài khóa luận', 'project' => 'SQL Course', 'priority' => 'medium', 'notes' => 'Hệ thống cơ sở dữ liệu phân tán hoặc công cụ hỗ trợ truy vấn thông minh.'],

        // Upcoming
        ['title' => 'Adv Web report: outline', 'project' => 'Adv Web', 'start' => 1, 'due' => 1, 'start_time' => '09:00', 'due_time' => '10:00', 'reminder' => '15m'],
        ['title' => 'Buy printer ink', 'due' => 1],
        ['title' => 'Chuẩn bị câu hỏi phỏng vấn thực tập sinh', 'project' => 'Portfolio', 'start' => 1, 'due' => 1, 'start_time' => '10:00', 'due_time' => '11:30', 'priority' => 'high', 'reminder' => '30m'],
        ['title' => 'Team sync for SQL project', 'project' => 'SQL Course', 'start' => 2, 'due' => 2, 'start_time' => '14:00', 'due_time' => '15:00', 'reminder' => '15m', 'priority' => 'high'],
        ['title' => 'HCI wireframe review', 'project' => 'HCI', 'start' => 2, 'due' => 2, 'start_time' => '14:00'],
        ['title' => 'Khám sức khỏe định kỳ', 'project' => 'Personal', 'start' => 2, 'due' => 2, 'start_time' => '08:30', 'reminder' => '1d', 'priority' => 'medium'],
        ['title' => 'Renew gym membership', 'project' => 'Personal', 'due' => 3, 'priority' => 'high'],
        ['title' => 'Submit Adv Web report', 'project' => 'Adv Web', 'due' => 3, 'priority' => 'high'],
        ['title' => 'Weekly review', 'project' => 'Personal', 'start' => 3, 'due' => 3, 'start_time' => '17:00', 'repeat' => 'weekly'],
        ['title' => 'SQL quiz', 'project' => 'SQL Course', 'start' => 6, 'due' => 6, 'start_time' => '09:00', 'reminder' => '1h', 'priority' => 'high'],
        ['title' => 'Monthly sprint retrospective', 'project' => 'Adv Web', 'start' => 7, 'due' => 7, 'start_time' => '15:00', 'repeat' => 'monthly', 'reminder' => '1h', 'priority' => 'medium'],
        ['title' => 'Update CV and portfolio links', 'project' => 'Portfolio', 'due' => 10, 'priority' => 'medium'],
        ['title' => 'Kỷ niệm thành lập nhóm nghiên cứu', 'project' => 'Personal', 'due' => 10, 'repeat' => 'yearly', 'priority' => 'low'],
        ['title' => 'Final project demo presentation', 'project' => 'Adv Web', 'start' => 14, 'due' => 14, 'start_time' => '08:00', 'due_time' => '11:00', 'reminder' => '1d', 'priority' => 'high', 'notes' => 'Chuẩn bị slide thuyết trình và chạy live demo cho hội đồng chấm đồ án.'],
    ];

    /**
     * The demo account used across the docs (test strategy: test data). Reseeding is idempotent:
     * it runs on every API container start (docker/api/start.sh).
     */
    public function run(ClockInterface $clock): void
    {
        $user = User::firstOrCreate(
            ['email' => 'example@gmail.com'],
            [
                'display_name' => 'example',
                'password' => 'password',
                'email_verified_at' => $clock->now(),
            ]
        );
        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => $clock->now()])->save();
        }

        $projects = [];
        foreach (self::PROJECTS as $name => $colour) {
            $projects[$name] = $this->project($user, $name, $colour, $clock)->id;
        }

        // Clean up previous tasks for example user to allow fresh idempotent seed
        Task::withoutGlobalScope('owner')->where('user_id', $user->id)->forceDelete();

        $today = new DateTimeImmutable($clock->today((string) $user->refresh()->timezone));
        $day = fn (?int $offset): ?string => $offset === null ? null : $today->modify("{$offset} days")->format('Y-m-d');

        foreach (self::TASKS as $row) {
            $factory = Task::factory();
            if ($row['done'] ?? false) {
                $factory = $factory->done();
            }
            $factory->create([
                ...array_diff_key($row, array_flip(['project', 'start', 'due', 'done'])),
                'user_id' => $user->id,
                'project_id' => isset($row['project']) ? $projects[$row['project']] : null,
                'start_date' => $day($row['start'] ?? null),
                'due_date' => $day($row['due'] ?? null),
            ]);
        }
    }

    private function project(User $user, string $name, string $colour, ClockInterface $clock): Project
    {
        $project = Project::withoutGlobalScope('owner')->where('user_id', $user->id)->where('name', $name)->first();
        if ($project === null) {
            return Project::factory()->create(['user_id' => $user->id, 'name' => $name, 'colour' => $colour]);
        }
        // Deleted since the last seed: bring it back, as Restore does, or the demo tasks would
        // point at a project no list shows ("Couldn't load your projects")
        if ($project->deleted_at !== null) {
            $project->deleted_at = null;
            $project->updated_at = Carbon::instance($clock->now());
            $project->field_updated_at = [...($project->field_updated_at ?? []), 'deleted' => Stamp::of($clock->now())];
            $project->save();
        }

        return $project;
    }
}
