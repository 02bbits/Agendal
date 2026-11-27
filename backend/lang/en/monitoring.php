<?php

// #225: alerts posted to the admins' Discord (App\Services\Monitoring\DiscordAlert), one block per alert kind
return [
    'slow_query' => [
        'title' => 'Warning: slow database query',
        'summary' => 'A query ran longer than the allowed threshold.',
    ],
    // #228
    'server_error' => [
        'title' => 'Critical: server error',
        'summary' => 'A request ended in an unhandled error (HTTP 5xx).',
    ],
    'job_failed' => [
        'title' => 'Critical: queued job failed',
        'summary' => 'A background job failed and will not be retried.',
    ],
    'schedule_failed' => [
        'title' => 'Critical: scheduled task failed',
        'summary' => 'A task in the schedule failed.',
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
        'error' => 'Error',
        'source' => 'Source',
        'job' => 'Job',
        'attempts' => 'Attempts',
        'command' => 'Command',
        'exit_code' => 'Exit code',
    ],
];
