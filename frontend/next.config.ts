import path from "node:path";
import type { NextConfig } from "next";

// Laravel API. The browser only talks to this app, so Sanctum's
// session cookies stay first-party and no CORS setup is needed (ADR-007).
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

// The dev mock for POST /notes imports the IM-02 fixtures from docs/, which sits outside frontend/.
// ponytail: Turbopack now watches the whole repo; narrow this back when IM-37 lands and the mock goes.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  cacheComponents: true,
  partialPrefetching: true,
  // NF-16 on every page. No script allow-list: Next.js inlines its bootstrap scripts
  // and a nonce would turn off the prerendered static pages (ASVS deviation 4).
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ]);
  },
  poweredByHeader: false,
  rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/sanctum/:path*", destination: `${apiUrl}/sanctum/:path*` },
    ];
  },
};

export default nextConfig;
