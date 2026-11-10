{!! strip_tags(html_entity_decode($header ?? '', ENT_QUOTES, 'UTF-8')) !!}

{!! strip_tags(html_entity_decode($slot, ENT_QUOTES, 'UTF-8')) !!}
@isset($subcopy)

{!! strip_tags(html_entity_decode($subcopy, ENT_QUOTES, 'UTF-8')) !!}
@endisset

{!! strip_tags(html_entity_decode($footer ?? '', ENT_QUOTES, 'UTF-8')) !!}
