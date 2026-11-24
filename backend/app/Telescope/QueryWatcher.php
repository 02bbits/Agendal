<?php

namespace App\Telescope;

use Laravel\Telescope\Watchers\QueryWatcher as BaseQueryWatcher;

// SC-21: bindings carry note and task text, so Telescope keeps the SQL with its placeholders
class QueryWatcher extends BaseQueryWatcher
{
    public function replaceBindings($event)
    {
        return $event->sql;
    }
}
