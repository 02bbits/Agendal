import type { NextConfig } from "next";

// Laravel API. The browser only talks to this app, so Sanctum's
// session cookies stay first-party and no CORS setup is needed (ADR-007).
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // NF-16 on every page. ponytail: no script-src yet. Next.js inlines its bootstrap
  // scripts, so a strict policy needs a per-request nonce, and nonces turn off the
  // static shells cacheComponents prerenders. Decide that before the IM-62 security pass.
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
