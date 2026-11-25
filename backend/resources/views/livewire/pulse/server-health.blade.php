{{-- #199: App\Livewire\Pulse\ServerHealth --}}
<x-pulse::card :cols="$cols" :rows="$rows" :class="$class">
    {{-- Pulse's prebuilt CSS has no red readable on its light theme --}}
    <style>.server-health-alert { color: #dc2626; font-weight: 700 } .dark .server-health-alert { color: #f87171 }</style>
    <x-pulse::card-header name="Server health" details="{{ $checkedAt ? 'checked '.\Carbon\CarbonImmutable::createFromTimestamp($checkedAt)->diffForHumans() : 'never checked' }}">
        <x-slot:icon>
            <x-pulse::icons.server />
        </x-slot:icon>
    </x-pulse::card-header>

    <x-pulse::scroll :expand="$expand" wire:poll.15s="">
        <x-pulse::table>
            <x-pulse::thead>
                <tr>
                    <x-pulse::th>Check</x-pulse::th>
                    <x-pulse::th class="text-right">Now</x-pulse::th>
                    <x-pulse::th class="text-right">Red at</x-pulse::th>
                </tr>
            </x-pulse::thead>
            <tbody>
                @foreach ($checks as [$label, $value, $limit, $alert])
                    <tr wire:key="{{ $label }}-spacer" class="h-2 first:h-0"></tr>
                    <tr wire:key="{{ $label }}-row" @class(['server-health-alert' => $alert])>
                        <x-pulse::td>{{ $label }}</x-pulse::td>
                        <x-pulse::td numeric @class(['text-gray-700 dark:text-gray-300' => ! $alert])>{{ $value }}</x-pulse::td>
                        <x-pulse::td numeric class="text-gray-500 dark:text-gray-400">{{ $limit }}</x-pulse::td>
                    </tr>
                @endforeach
            </tbody>
        </x-pulse::table>
    </x-pulse::scroll>
</x-pulse::card>
