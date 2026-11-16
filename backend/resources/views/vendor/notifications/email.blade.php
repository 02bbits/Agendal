<x-mail::message :title="$title ?? null">
{{-- Heading: the email's purpose, also the page title --}}
@isset($title)
# {{ $title }}
@endisset

@if (! empty($greeting))
{{ $greeting }}

@endif
@foreach ($introLines as $line)
{{ $line }}

@endforeach
@isset($actionText)
<x-mail::button :url="$actionUrl" :color="$actionColor ?? 'primary'">
{{ $actionText }}
</x-mail::button>
@endisset

@foreach ($outroLines as $line)
{{ $line }}

@endforeach
@if (! empty($salutation))
{{ $salutation }}
@endif
</x-mail::message>
