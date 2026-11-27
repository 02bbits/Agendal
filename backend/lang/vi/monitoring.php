<?php

// #225: alerts posted to the admins' Discord (App\Services\Monitoring\DiscordAlert), one block per alert kind
return [
    'slow_query' => [
        'title' => 'Cảnh báo: truy vấn cơ sở dữ liệu chậm',
        'summary' => 'Một câu truy vấn đã chạy lâu hơn ngưỡng cho phép.',
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
    ],
];
