<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Laravel\Telescope\EntryType;
use Laravel\Telescope\IncomingEntry;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

class TelescopeServiceProvider extends TelescopeApplicationServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->hideSensitiveDetails();

        $isLocal = $this->app->environment('local');

        // Outside local, every request, job and scheduled run, plus what points at a fault;
        // not every query, cache hit or model event
        Telescope::filter(function (IncomingEntry $entry) use ($isLocal) {
            return $isLocal ||
                   in_array($entry->type, [EntryType::REQUEST, EntryType::JOB, EntryType::SCHEDULED_TASK], true) ||
                   $entry->isReportableException() ||
                   $entry->isSlowQuery() ||
                   $entry->hasMonitoredTag();
        });
    }

    /**
     * SC-21: no note or task text, passwords, codes, emails or session tokens in an entry, in any
     * environment. Queries drop their bindings in App\Telescope\QueryWatcher.
     */
    protected function hideSensitiveDetails(): void
    {
        // Applies to response headers too
        Telescope::hideRequestHeaders(['cookie', 'set-cookie', 'x-csrf-token', 'x-xsrf-token', 'authorization']);

        Telescope::afterRecording(function (Telescope $telescope, IncomingEntry $entry) {
            if (isset($entry->content['user'])) {
                $entry->content['user'] = ['id' => $entry->content['user']['id']];
            }
            if ($entry->type === EntryType::REQUEST) {
                // Bodies nest free text (sync patches, note results), so keep their shape only
                array_walk_recursive($entry->content['payload'], function (&$value) {
                    $value = '********';
                });
                $entry->content['session'] = [];
                $entry->content['response'] = 'Purged By Telescope';
            }
            // Lockout keys and sign-up codes' recipients name an email
            $noEmail = fn (string $text) => preg_replace('/[^:|,\s]+@[^:|,\s]+/', '[email]', $text);
            if ($entry->type === EntryType::CACHE) {
                unset($entry->content['value']);
                $entry->content['key'] = $noEmail($entry->content['key']);
            }
            if ($entry->type === EntryType::NOTIFICATION) {
                $entry->content['notifiable'] = $noEmail($entry->content['notifiable']);
            }
            if ($entry->type === EntryType::JOB) {
                $entry->content['data'] = [];
            }
        });
    }

    /**
     * Register the Telescope gate.
     *
     * This gate determines who can access Telescope in non-local environments.
     */
    protected function gate(): void
    {
        Gate::define('viewTelescope', fn (User $user) => in_array($user->email, config('telescope.allowed_emails'), true));
    }
}
