// IM-50: app-shell cache (AP §2.2, NF-4) that never touches the API (NF-19, SEC-51).
// The ?v= build id in this script's URL gives every deploy a new worker, so updates are detected.
const CACHE = `agendal-shell-${new URL(self.location.href).searchParams.get("v") ?? "dev"}`;

// Every screen, so each opens offline on the first visit, not only those already seen (AP §2.2).
// A detail screen's page is the same for every id, so `/tasks/_` stands in for all tasks
const PAGES = [
  "/",
  "/upcoming",
  "/projects",
  "/notes",
  "/search",
  "/account",
  "/sign-in",
  "/tasks/_",
  "/projects/_",
  "/notes/_",
];
const DETAIL = /^\/(tasks|projects|notes)\/[^/]+$/;

/** The cached page for a navigation: its own, else its screen's stand-in, else the Inbox. */
async function cachedPage(url) {
  const hit = await caches.match(url.pathname, { ignoreSearch: true });
  if (hit) return hit;
  const detail = url.pathname.match(DETAIL);
  return (detail && caches.match(`/${detail[1]}/_`)) || caches.match("/");
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: the page offers Reload instead (UX-42)
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll([
        ...PAGES,
        "/theme.js",
        // Empty states show offline too, before any screen was empty online
        ...["inbox", "projects", "notes"].flatMap((name) => [
          `/illustrations/empty-${name}-light.svg`,
          `/illustrations/empty-${name}-dark.svg`,
        ]),
      ]);
      // And the scripts and styles those pages load
      const assets = new Set();
      for (const page of PAGES) {
        const html = await (await cache.match(page)).text();
        for (const [path] of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g))
          assets.add(path);
      }
      await cache.addAll([...assets]);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith("agendal-shell-") && name !== CACHE,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Same-origin pages and files only: the API and sign-in cookies stay uncached (SEC-51)
const cacheable = (url) =>
  url.origin === self.location.origin &&
  !url.pathname.startsWith("/api/") &&
  !url.pathname.startsWith("/sanctum/") &&
  !url.searchParams.has("_rsc");

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
  // First visit: the page loaded its assets before this worker took over, so it lists them here (AP §2.2)
  else if (Array.isArray(event.data?.precache))
    event.waitUntil(
      Promise.all(
        event.data.precache
          .map((href) => new URL(href, self.location.origin))
          .filter(cacheable)
          .map((url) => new Request(url.href))
          .map((request) =>
            caches.match(request).then(
              (hit) =>
                hit ??
                fetch(request)
                  .then((r) => store(request, r))
                  .catch(() => {}),
            ),
          ),
      ),
    );
});

const store = async (request, response) => {
  // Only whole, same-origin pages and files: no redirects, errors or opaque responses
  if (response.ok && response.type === "basic" && !response.redirected)
    await (await caches.open(CACHE)).put(request, response.clone());
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Anything else goes straight to the network
  if (request.method !== "GET" || !cacheable(url) || request.headers.has("RSC"))
    return;

  if (url.pathname.startsWith("/_next/static/")) {
    // Hashed filenames never change, so the cache wins
    event.respondWith(
      caches
        .match(request)
        .then((hit) => hit ?? fetch(request).then((r) => store(request, r))),
    );
    return;
  }

  // Pages and small files: network first, so a deploy shows at once; the cache covers offline
  event.respondWith(
    fetch(request)
      .then((response) => store(request, response))
      .catch(async () => {
        if (request.mode === "navigate") return cachedPage(url);
        return (await caches.match(request)) ?? Response.error();
      }),
  );
});
