// IM-50: app-shell cache (AP §2.2, NF-4) that never touches the API (NF-19, SEC-51).
// The ?v= build id in this script's URL gives every deploy a new worker, so updates are detected.
const CACHE = `agendal-shell-${new URL(self.location.href).searchParams.get("v") ?? "dev"}`;

self.addEventListener("install", (event) => {
  // No skipWaiting here: the page offers Reload instead (UX-42)
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/theme.js"])),
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
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate") return caches.match("/");
        return Response.error();
      }),
  );
});
