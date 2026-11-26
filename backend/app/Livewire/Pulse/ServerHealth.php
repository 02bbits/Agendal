<?php

namespace App\Livewire\Pulse;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Support\Renderable;
use Illuminate\Support\Facades\View;
use Laravel\Pulse\Livewire\Card;
use Livewire\Attributes\Lazy;

/**
 * #199: the rows App\Pulse\HostHealth last wrote, red past a threshold. A snapshot older than a minute means
 * `pulse:check` (the pulse service) has stopped.
 */
#[Lazy]
class ServerHealth extends Card
{
    public function render(): Renderable
    {
        $snapshot = $this->values('host_health', ['server'])->first();
        $stale = $snapshot === null || CarbonImmutable::createFromTimestamp($snapshot->timestamp)->addMinute()->isPast();
        $checks = $snapshot === null ? [] : json_decode($snapshot->value, true, flags: JSON_THROW_ON_ERROR);

        return View::make('livewire.pulse.server-health', [
            'checks' => $stale ? [['Monitor', 'not running', 'pulse:check', true], ...$checks] : $checks,
            'checkedAt' => $snapshot?->timestamp,
        ]);
    }
}
