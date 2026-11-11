@props([
    'url',
    'color' => 'primary',
    'align' => 'center',
])
@if ($color === 'link')
<p style="margin-top: 20px; margin-bottom: 20px; text-align: left;">
<a href="{{ $url }}" class="link-action" target="_blank" rel="noopener">{!! $slot !!} &rarr;</a>
</p>
@else
<table class="action" align="{{ $align }}" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td align="{{ $align }}">
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td align="{{ $align }}">
<table border="0" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td>
<a href="{{ $url }}" class="button button-primary" target="_blank" rel="noopener">{!! $slot !!}</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
@endif
