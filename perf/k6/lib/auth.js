import http from "k6/http";
import { check } from "k6";

/**
 * Generates an RFC 4122 UUID v4 string for idempotent note client_id / task IDs.
 */
export function uuidv4() {
  const bytes = [];
  for (let i = 0; i < 16; i += 1) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/**
 * Extracts the decoded XSRF-TOKEN cookie from the current VU cookie jar.
 */
export function xsrfHeader(baseUrl) {
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(baseUrl);
  const raw = cookies["XSRF-TOKEN"];
  if (!raw || raw.length === 0) {
    return {};
  }
  return { "X-XSRF-TOKEN": decodeURIComponent(raw[0]) };
}

/**
 * Standard JSON + Sanctum stateful headers (Origin/Referer + X-XSRF-TOKEN).
 */
export function apiHeaders(baseUrl) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    ...xsrfHeader(baseUrl),
  };
}

/**
 * Signs in via Sanctum session cookies so subsequent VU requests carry an authenticated session.
 */
export function signIn(baseUrl, email, password) {
  // Prime session / XSRF cookie first
  http.get(`${baseUrl}/api/v1/health`, {
    headers: { Origin: baseUrl, Referer: `${baseUrl}/` },
  });

  const res = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: apiHeaders(baseUrl),
      tags: { name: "auth_login" },
    },
  );

  check(res, {
    "signed in (200)": (r) => r.status === 200,
  });

  return res.status === 200;
}
