<?php

// #225: alerts posted to the admins' Discord (App\Services\Monitoring\DiscordAlert), one block per alert kind
return [
    'slow_query' => [
        'title' => 'Warning: slow database query',
        'summary' => 'A query ran longer than the allowed threshold.',
    ],
    'severity' => ['warning' => 'Warning', 'critical' => 'Critical'],
    'fields' => [
        'severity' => 'Severity',
        'environment' => 'Environment',
        'duration' => 'Duration',
        'threshold' => 'Threshold',
        'where' => 'Location',
        'request_id' => 'Request ID',
        'sql' => 'Query (without values)',
    ],
];
