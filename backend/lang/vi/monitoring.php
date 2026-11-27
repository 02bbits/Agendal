<?php

// #225: alerts posted to the admins' Discord (App\Services\Monitoring\DiscordAlert), one block per alert kind
return [
    'slow_query' => [
        'title' => 'Cảnh báo: truy vấn cơ sở dữ liệu chậm',
        'summary' => 'Một câu truy vấn đã chạy lâu hơn ngưỡng cho phép.',
    ],
    // #228
    'server_error' => [
        'title' => 'Nghiêm trọng: lỗi máy chủ',
        'summary' => 'Một request đã kết thúc bằng lỗi chưa được xử lý (HTTP 5xx).',
    ],
    'job_failed' => [
        'title' => 'Nghiêm trọng: job hàng đợi thất bại',
        'summary' => 'Một job nền đã thất bại và không được thử lại nữa.',
    ],
    'schedule_failed' => [
        'title' => 'Nghiêm trọng: tác vụ định kỳ thất bại',
        'summary' => 'Một tác vụ trong lịch chạy định kỳ đã thất bại.',
    ],
    'severity' => ['warning' => 'Cảnh báo', 'critical' => 'Nghiêm trọng'],
    'fields' => [
        'severity' => 'Mức độ',
        'environment' => 'Môi trường',
        'duration' => 'Thời gian thực thi',
        'threshold' => 'Ngưỡng',
        'where' => 'Vị trí',
        'request_id' => 'Mã request',
        'sql' => 'Câu truy vấn (không kèm giá trị)',
        'error' => 'Lỗi',
        'source' => 'Vị trí mã nguồn',
        'job' => 'Job',
        'attempts' => 'Số lần thử',
        'command' => 'Lệnh',
        'exit_code' => 'Mã thoát',
    ],
];
