@props(['title' => null])
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
<title>{{ $title ?: config('app.name') }}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
@media only screen and (max-width: 600px) {
.inner-body {
width: 100% !important;
}

.footer {
width: 100% !important;
}

.content-cell {
padding: 24px !important;
}
}

@media only screen and (max-width: 500px) {
.button {
width: 100% !important;
text-align: center !important;
}
}

@media (prefers-color-scheme: dark) {
body,
.wrapper,
.body {
background-color: #1A1A1A !important;
background: #1A1A1A !important;
}

.inner-body {
background-color: #252525 !important;
background: #252525 !important;
border-color: #363636 !important;
}

h1,
h2,
h3,
p,
span,
td,
.content-cell {
color: #EDEDED !important;
}

a {
color: #EDEDED !important;
}

.subcopy,
.subcopy p,
.subcopy a,
.footer,
.footer p,
.footer a {
color: #A6A6A6 !important;
}

.subcopy {
border-color: #363636 !important;
}

.button,
.button-primary {
background-color: #CFCFCF !important;
background: #CFCFCF !important;
border-color: #CFCFCF !important;
color: #252525 !important;
}

.brand-mark {
background-color: #EDEDED !important;
background: #EDEDED !important;
color: #252525 !important;
}

.brand-mark span {
color: #252525 !important;
}

.brand-name {
color: #EDEDED !important;
}

.panel {
border-left-color: #EDEDED !important;
}

.panel-content {
background-color: #1A1A1A !important;
color: #EDEDED !important;
}

.panel-content p {
color: #EDEDED !important;
}

.code-box {
background-color: #1A1A1A !important;
color: #EDEDED !important;
}
}

[data-ogsc] body,
[data-ogsc] .wrapper,
[data-ogsc] .body {
background-color: #1A1A1A !important;
background: #1A1A1A !important;
}

[data-ogsc] .inner-body {
background-color: #252525 !important;
background: #252525 !important;
border-color: #363636 !important;
}

[data-ogsc] h1,
[data-ogsc] h2,
[data-ogsc] h3,
[data-ogsc] p,
[data-ogsc] span,
[data-ogsc] td,
[data-ogsc] .content-cell {
color: #EDEDED !important;
}

[data-ogsc] a {
color: #EDEDED !important;
}

[data-ogsc] .subcopy,
[data-ogsc] .subcopy p,
[data-ogsc] .subcopy a,
[data-ogsc] .footer,
[data-ogsc] .footer p,
[data-ogsc] .footer a {
color: #A6A6A6 !important;
}

[data-ogsc] .subcopy {
border-color: #363636 !important;
}

[data-ogsc] .button,
[data-ogsc] .button-primary {
background-color: #CFCFCF !important;
background: #CFCFCF !important;
border-color: #CFCFCF !important;
color: #252525 !important;
}

[data-ogsc] .brand-mark {
background-color: #EDEDED !important;
background: #EDEDED !important;
color: #252525 !important;
}

[data-ogsc] .brand-mark span {
color: #252525 !important;
}

[data-ogsc] .brand-name {
color: #EDEDED !important;
}

[data-ogsc] .panel {
border-left-color: #EDEDED !important;
}

[data-ogsc] .panel-content {
background-color: #1A1A1A !important;
color: #EDEDED !important;
}

[data-ogsc] .panel-content p {
color: #EDEDED !important;
}
</style>
{!! $head ?? '' !!}
</head>
<body>

<table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#F2F2F2">
<tr>
<td align="center">
<table class="content" width="100%" cellpadding="0" cellspacing="0" role="presentation">
{!! $header ?? '' !!}

<!-- Email Body -->
<tr>
<td class="body" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F2F2F2" style="border: hidden !important;">
<table class="inner-body" align="center" width="520" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#FFFFFF">
<!-- Body content -->
<tr>
<td class="content-cell">
{!! Illuminate\Mail\Markdown::parse($slot) !!}

{!! $subcopy ?? '' !!}
</td>
</tr>
</table>
</td>
</tr>

{!! $footer ?? '' !!}
</table>
</td>
</tr>
</table>
</body>
</html>
