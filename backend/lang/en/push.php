<?php

// Web Push reminders (TK-6). The notification's text is the task title and its time, built in
// App\Services\Push\ReminderMessage.
return [
    'endpoint_not_allowed' => 'This browser\'s push service isn\'t supported.',
    'not_configured' => 'Reminders aren\'t set up on the server yet.',
    'no_devices' => 'This device isn\'t set up for reminders.',
    // The test from Settings > Notifications
    'test_title' => 'Test reminder',
    'test_body' => 'Reminders work on this device.',
];
