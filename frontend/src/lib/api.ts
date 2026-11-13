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

// Every API call goes through here, so the server always has the device zone (ADR-006) and the
// device id that breaks same-millisecond ties (ADR-004),
// and every write carries the CSRF token from Sanctum's XSRF-TOKEN cookie (ADR-007)
export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Timezone", timeZone());
  headers.set("X-Device-Id", deviceId());

  const method = (init.method ?? "GET").toUpperCase();
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
      ...init,
      headers,
    });
  } catch (error) {
    // No answer at all: the network is down whatever `navigator.onLine` says (AP-E4)
    if (!init.signal?.aborted) reportFetch(false);
    throw error;
  }
  reportFetch(true);
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
