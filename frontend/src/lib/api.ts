import { timeZone } from "./clock";
import { deviceId } from "./device";
import { reportFetch } from "./online";

const readXsrf = () => {
  const value = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1];
  return value && decodeURIComponent(value);
};

/** Fired on `window` when a signed-in call answers 401. */
export const SESSION_EXPIRED = "agendal:session-expired";
/** Fired on `window` when an API call answers 403 with auth.email_unverified. */
export const EMAIL_UNVERIFIED = "agendal:email-unverified";

/** Reads started in the running task, by path: callers asking for the same one together share it. */
const inflight = new Map<string, Promise<Response>>();
/** The last tagged answer per read path, kept in memory only: the HTTP cache stays off (NF-19). */
const tagged = new Map<string, { etag: string; body: string }>();

/**
 * Every API call goes through here. Identical reads started in the same task (a screen and the
 * sidebar mounting, one reload after a change) share one request, each caller getting its own copy
 * of the answer (AP §10 request budget). A later read never joins an older one, so a request that
 * hangs can't hold the next ones. A read with an abort signal is never shared, so one caller's
 * abort can't cancel another's. A read the server tagged with an ETag asks again with
 * If-None-Match, and a 304 hands back the body kept from last time (#201).
 */
export function api(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" || init.signal) return send(path, init);
  let shared = inflight.get(path);
  if (!shared) {
    shared = send(path, init);
    inflight.set(path, shared);
    // Once this task's code has run: a microtask, so fake timers in tests don't hold it
    queueMicrotask(() => inflight.delete(path));
  }
  return shared.then((response) => response.clone());
}

// The server always gets the device zone (ADR-006) and the device id that breaks
// same-millisecond ties (ADR-004), and every write carries the CSRF token from Sanctum's
// XSRF-TOKEN cookie (ADR-007)
async function send(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Timezone", timeZone());
  headers.set("X-Device-Id", deviceId());

  const method = (init.method ?? "GET").toUpperCase();
  const last = method === "GET" ? tagged.get(path) : undefined;
  if (last) headers.set("If-None-Match", last.etag);
  // Signing in or out: the kept answers belong to the account that is leaving (SC-19)
  if (path.startsWith("/auth/") && method !== "GET") tagged.clear();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!readXsrf()) {
      await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    }
    headers.set("X-XSRF-TOKEN", readXsrf() ?? "");
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
      headers,
    });
  } catch (error) {
    // No answer at all: the network is down whatever `navigator.onLine` says (AP-E4)
    if (!init.signal?.aborted) reportFetch(false);
    throw error;
  }
  reportFetch(true);
  if (response.status === 304 && last) {
    return new Response(last.body, {
      headers: { "Content-Type": "application/json", ETag: last.etag },
    });
  }
  const etag = response.headers.get("ETag");
  if (method === "GET" && response.ok && etag) {
    tagged.set(path, { etag, body: await response.clone().text() });
    // ponytail: keeps the 20 newest paths (sync's cursor moves on); LRU if a screen ever polls more
    if (tagged.size > 20) tagged.delete(tagged.keys().next().value!);
  } else if (method === "GET") {
    tagged.delete(path);
  }
  // A signed-in call refused: the session ended elsewhere (password changed, expired). Sign-in
  // and sign-out answer 401 as part of their own flow, so they don't count (UX-44)
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  if (response.status === 403) {
    response
      .clone()
      .json()
      .then((body) => {
        if (body?.error?.code === "auth.email_unverified") {
          window.dispatchEvent(new Event(EMAIL_UNVERIFIED));
        }
      })
      .catch(() => {});
  }
  return response;
}
