{{-- #198: every framework error page (403, 404, 500, 503 ...) in the Graphite look --}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title') · Agendal</title>
    <style>
        :root { --bg: #f2f2f2; --surface: #fff; --ink: #252525; --ink-2: #545454; color-scheme: light dark; }
        @media (prefers-color-scheme: dark) { :root { --bg: #1a1a1a; --surface: #252525; --ink: #ededed; --ink-2: #a6a6a6; } }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
            background: var(--bg); color: var(--ink); font: 15px/1.5 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; }
        main { background: var(--surface); border-radius: 12px; padding: 24px 28px; max-width: 360px; width: 100%; }
        p { margin: 0; }
        .code { color: var(--ink-2); font-size: 13px; }
        h1 { margin: 4px 0 0; font-size: 20px; font-weight: 600; }
    </style>
</head>
<body>
    <main>
        <p class="code">Error @yield('code')</p>
        <h1>@yield('message')</h1>
    </main>
</body>
</html>
