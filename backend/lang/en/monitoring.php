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
    // #229
    'host_over' => [
        'title' => ':metric over the threshold',
        'summary' => 'The server :metric is over the allowed threshold.',
    ],
    'host_normal' => [
        'title' => ':metric back to normal',
        'summary' => 'The server :metric is back within the allowed threshold.',
    ],
    'monitor_down' => [
        'title' => 'Server monitor stopped',
        'summary' => 'No new server reading for over :minutes minutes; the server state is unknown.',
    ],
    'monitor_up' => [
        'title' => 'Server monitor running again',
        'summary' => 'New server readings are in.',
    ],
    'metrics' => [
        'cpu' => 'CPU',
        'memory' => 'Memory',
        'disk' => 'Disk',
        'last_backup' => 'Last backup',
        'api' => 'API',
        'web_app' => 'Web app',
    ],
    'severity' => ['warning' => 'Warning', 'critical' => 'Critical', 'resolved' => 'Resolved'],
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
        'metric' => 'Metric',
        'value' => 'Current value',
        'last_reading' => 'Last reading',
    ],
];
