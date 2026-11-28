<?php

use App\Livewire\Pulse\ServerHealth;
use App\Pulse\HostHealth;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Pulse\Events\SharedBeat;
use Laravel\Pulse\Facades\Pulse;
use Laravel\Pulse\PulseServiceProvider;
use Laravel\Pulse\Recorders\Servers;
use Livewire\Livewire;

// #199: the Server health card. HostHealth reads a fake /proc here; the health URLs are faked
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['pulse.enabled' => true]);
    (new PulseServiceProvider(app()))->boot();
    Pulse::startRecording();
    $this->proc = sys_get_temp_dir().'/pulse-proc-'.Str::random(8);
    mkdir($this->proc);
    $this->apiUp = true;
    Http::fake(fn ($request) => str_contains($request->url(), 'api:8000') && ! $this->apiUp ? Http::response('', 503) : Http::response('ok'));
    // 8 GB, half available; 2 GB swap, half used; 4 cores
    hostFiles($this->proc, busy: 0, idle: 0, availableKb: 4_000_000);
    file_put_contents(storage_path('app/last-backup'), (string) now()->subHours(2)->getTimestamp());
    $this->recorder = app(HostHealth::class);
});

afterEach(fn () => @unlink(storage_path('app/last-backup')));

function hostFiles(string $proc, int $busy, int $idle, int $availableKb): void
{
    $cpus = implode("\n", array_map(fn (int $i) => "cpu$i 1 0 1 1 0 0 0 0 0 0", range(0, 3)));
    file_put_contents("$proc/stat", "cpu  $busy 0 0 $idle 0 0 0 0 0 0\n$cpus\nintr 1\n");
    file_put_contents("$proc/meminfo", "MemTotal:        8000000 kB\nMemFree:  100 kB\nMemAvailable:    $availableKb kB\nSwapTotal:       2097152 kB\nSwapFree:        1048576 kB\n");
    file_put_contents("$proc/loadavg", "0.42 0.30 0.20 1/300 123\n");
}

/** One pulse:check beat 15 s after the last; the card's rows by label => [value, red] */
function beat(HostHealth $recorder): array
{
    test()->travel(15)->seconds();
    $recorder->record(new SharedBeat(CarbonImmutable::now(), 'test'));
    Pulse::ingest();

    return collect(json_decode(Pulse::values('host_health', ['server'])->first()->value, true))
        ->mapWithKeys(fn (array $row) => [$row[0] => [$row[1], $row[3]]])->all();
}

it('#199: reads CPU between two samples, memory, swap, load, disk, Postgres, backup and the URLs, all OK', function () {
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc]);
    beat($this->recorder);
    hostFiles($this->proc, busy: 50, idle: 50, availableKb: 4_000_000);

    $rows = beat($this->recorder);

    expect($rows['CPU'])->toBe(['50%', false])
        ->and($rows['Memory'])->toBe(['50% of 7.6 GB', false])
        ->and($rows['Swap'])->toBe(['1024 of 2048 MB', false])
        ->and($rows['Load (1 min)'])->toBe(['0.42 on 4 cores', false])
        ->and($rows['Disk'][0])->toMatch('/^\d+% of \d+ GB$/')
        ->and($rows['Postgres connections'][0])->toMatch('/^\d+ of \d+$/')
        ->and($rows['Last backup'])->toBe(['2 h ago', false])
        ->and($rows['API'])->toBe(['up', false])
        ->and($rows['Web app'])->toBe(['up', false])
        ->and(HostHealth::$cpu)->toBe(50);
});

it('#199: CPU over 85% turns red only once it has lasted 5 minutes', function () {
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc]);
    $red = [];
    foreach (range(1, 21) as $n) { // 21 beats, 15 s apart: high from the first, 5 min at the 21st
        hostFiles($this->proc, busy: 90 * $n, idle: 10 * $n, availableKb: 4_000_000);
        $red[] = beat($this->recorder)['CPU'][1];
    }

    expect(array_slice($red, 0, 20))->each->toBeFalse()->and($red[20])->toBeTrue();
});

it('#199: the API turns red only after 2 minutes down, and green again once it answers', function () {
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc]);
    $this->apiUp = false;
    $rows = collect(range(1, 9))->map(fn () => beat($this->recorder)['API']); // 0 s to 2 min down

    $this->apiUp = true;

    expect($rows->first())->toBe(['down', false])->and($rows[7])->toBe(['down', false])
        ->and($rows->last())->toBe(['down', true])
        ->and(beat($this->recorder)['API'])->toBe(['up', false]);
});

it('#199: memory over 90% and a backup over 26 hours old, or none, are red', function () {
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc]);
    hostFiles($this->proc, busy: 0, idle: 0, availableKb: 700_000);
    file_put_contents(storage_path('app/last-backup'), (string) now()->subHours(27)->getTimestamp());

    $rows = beat($this->recorder);
    unlink(storage_path('app/last-backup'));

    expect($rows['Memory'])->toBe(['92% of 7.6 GB', true])
        ->and($rows['Last backup'])->toBe(['27 h ago', true])
        ->and(beat($this->recorder)['Last backup'])->toBe(['none recorded', true]);
});

it('#199: the card shows the checks, red past a threshold, and says when pulse:check has stopped', function () {
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc]);
    $this->apiUp = false;
    foreach (range(1, 9) as $n) {
        beat($this->recorder);
    }

    Livewire::withoutLazyLoading()->test(ServerHealth::class)
        ->assertSeeInOrder(['CPU', 'Memory', 'Last backup', 'API'])
        ->assertSeeHtml('class="server-health-alert"')
        ->assertDontSee('not running');

    $this->travel(2)->minutes();
    Livewire::withoutLazyLoading()->test(ServerHealth::class)->assertSeeInOrder(['Monitor', 'not running']);
});

/** The host's /proc/1/net: eth0 carries the default route; docker0 is busier but is not it */
function netFiles(string $dir, int $rx, int $tx): void
{
    @mkdir($dir);
    file_put_contents("$dir/route", "Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT\n"
        ."docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0\neth0\t00000000\t0101A8C0\t0003\t0\t0\t0\t00000000\t0\t0\t0\n");
    file_put_contents("$dir/dev", "Inter-|   Receive |  Transmit\n face |bytes packets|bytes packets\n"
        ."docker0: 999999999 1 0 0 0 0 0 0 999999999 1 0 0 0 0 0 0\n  eth0: $rx 10 0 0 0 0 0 0 $tx 10 0 0 0 0 0 0\n");
}

// 15 s at 12 Mbit/s in and 3 Mbit/s out
const NET_RX_PER_BEAT = 22_500_000;
const NET_TX_PER_BEAT = 5_625_000;

it('#233: Network reads the default route\'s traffic between two readings', function () {
    $net = $this->proc.'/net';
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc, 'pulse.recorders.'.HostHealth::class.'.net' => $net]);
    netFiles($net, rx: 1_000, tx: 1_000);
    $first = beat($this->recorder)['Network'];
    netFiles($net, rx: 1_000 + NET_RX_PER_BEAT, tx: 1_000 + NET_TX_PER_BEAT);

    expect($first)->toBe(['in 0 / out 0 Mbit/s', false])
        ->and(beat($this->recorder)['Network'])->toBe(['in 12 / out 3 Mbit/s', false]);

    netFiles($net, rx: 0, tx: 0); // the counters went back (reboot): nothing moved, never negative
    expect(beat($this->recorder)['Network'])->toBe(['in 0 / out 0 Mbit/s', false]);
});

it('#233: without the host\'s network mounted, Network is "not available" with no threshold', function () {
    config(['pulse.recorders.'.HostHealth::class.'.proc' => $this->proc, 'pulse.recorders.'.HostHealth::class.'.net' => $this->proc.'/none']);

    expect(beat($this->recorder)['Network'])->toBe(['not available', false]);
});

it('#233: Network over its threshold for 5 minutes turns red and posts once, then back to normal once', function () {
    $net = $this->proc.'/net';
    $webhook = tempnam(sys_get_temp_dir(), 'webhook');
    file_put_contents($webhook, 'https://discord.test/x');
    config([
        'pulse.recorders.'.HostHealth::class.'.proc' => $this->proc,
        'pulse.recorders.'.HostHealth::class.'.net' => $net,
        'pulse.recorders.'.HostHealth::class.'.network_mbps' => 10,
        'logging.discord_alert.webhook_file' => $webhook,
    ]);
    $red = [];
    foreach (range(0, 21) as $n) { // 12 Mbit/s from the 2nd beat (the 1st has nothing to compare): 5 min at the 22nd
        netFiles($net, rx: NET_RX_PER_BEAT * $n, tx: 0);
        $red[] = beat($this->recorder)['Network'][1];
    }
    beat($this->recorder); // nothing moved since: back to normal

    $titles = collect(Http::recorded())->filter(fn ($pair) => $pair[0]->url() === 'https://discord.test/x')
        ->map(fn ($pair) => $pair[0]['embeds'][0]['title'])->filter(fn ($t) => str_starts_with($t, 'Mạng'))->values()->all();
    expect(array_slice($red, 0, 21))->each->toBeFalse()->and($red[21])->toBeTrue()
        ->and($titles)->toBe(['Mạng vượt ngưỡng', 'Mạng đã trở lại bình thường']);
});

it('#199: the Servers card takes its CPU from HostHealth, not `top`', function () {
    HostHealth::$cpu = 42;

    app(Servers::class)->record(new SharedBeat(CarbonImmutable::now(), 'test'));
    Pulse::ingest();

    expect(json_decode(Pulse::values('system')->first()->value)->cpu)->toBe(42);
});
