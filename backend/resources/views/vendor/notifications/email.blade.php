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
<x-mail::button :url="$actionUrl">
{{ $actionText }}
</x-mail::button>
@endisset

@foreach ($outroLines as $line)
{{ $line }}

@endforeach
@if (! empty($salutation))
{{ $salutation }}
@endif

{{-- The full link, for when the button is hidden or blocked --}}
@isset($actionText)
<x-slot:subcopy>
{{ __('email.link_fallback') }} <span class="break-all">[{{ $displayableActionUrl }}]({{ $actionUrl }})</span>
</x-slot:subcopy>
@endisset
</x-mail::message>
