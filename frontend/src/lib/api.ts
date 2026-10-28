import { timeZone } from "./clock";

// Every API call goes through here, so the server always has the device zone (ADR-006)
export function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Timezone", timeZone());

  return fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...init,
    headers,
  });
}
