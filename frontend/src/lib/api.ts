import { timeZone } from "./clock";

const readXsrf = () => {
  const value = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1];
  return value && decodeURIComponent(value);
};

/** Fired on `window` when a signed-in call answers 401. */
export const SESSION_EXPIRED = "agendal:session-expired";

// Every API call goes through here, so the server always has the device zone (ADR-006),
// and every write carries the CSRF token from Sanctum's XSRF-TOKEN cookie (ADR-007)
export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Timezone", timeZone());

  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!readXsrf()) {
      await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    }
    headers.set("X-XSRF-TOKEN", readXsrf() ?? "");
  }

  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...init,
    headers,
  });
  // A signed-in call refused: the session ended elsewhere (password changed, expired). Sign-in
  // and sign-out answer 401 as part of their own flow, so they don't count (UX-44)
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  return response;
}
