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
    // #229
    'host_over' => [
        'title' => ':metric vượt ngưỡng',
        'summary' => 'Chỉ số :metric của máy chủ đã vượt ngưỡng cho phép.',
    ],
    'host_normal' => [
        'title' => ':metric đã trở lại bình thường',
        'summary' => 'Chỉ số :metric của máy chủ đã trở lại trong ngưỡng cho phép.',
    ],
    'monitor_down' => [
        'title' => 'Giám sát máy chủ ngừng hoạt động',
        'summary' => 'Không có số đo mới của máy chủ trong hơn :minutes phút; không xác định được tình trạng máy chủ.',
    ],
    'monitor_up' => [
        'title' => 'Giám sát máy chủ hoạt động trở lại',
        'summary' => 'Đã có số đo mới của máy chủ.',
    ],
    'metrics' => [
        'cpu' => 'CPU',
        'memory' => 'Bộ nhớ',
        'disk' => 'Ổ đĩa',
        'last_backup' => 'Sao lưu gần nhất',
        'api' => 'API',
        'web_app' => 'Web app',
    ],
    'severity' => ['warning' => 'Cảnh báo', 'critical' => 'Nghiêm trọng', 'resolved' => 'Đã khôi phục'],
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
        'metric' => 'Chỉ số',
        'value' => 'Giá trị hiện tại',
        'last_reading' => 'Số đo gần nhất',
    ],
];
