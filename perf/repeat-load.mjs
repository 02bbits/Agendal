/**
 * IM-63 / NF-4 Repeat Load Verification (<= 1,000 ms from Service Worker / cache)
 *
 * Uses Playwright Chromium + CDP 4G / 4x CPU throttling to:
 *  1. Visit the app once so the Service Worker installs and caches all routes/assets.
 *  2. Measure a second (repeat) load across all shell routes and assert domInteractive <= 1000 ms.
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const BUDGET_MS = Number(process.env.REPEAT_LOAD_BUDGET_MS || 1000);
const PERF_EMAIL = process.env.PERF_EMAIL || "";
const PERF_PASSWORD = process.env.PERF_PASSWORD || "";
const ROUTES = ["/", "/upcoming", "/projects", "/notes", "/search", "/sign-in"];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();

  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1638.4 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  // 1. Warm up Service Worker on /sign-in and wait until SW is active
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
  });

  // Sign in if credentials are provided so protected routes warm & measure real views
  if (PERF_EMAIL && PERF_PASSWORD) {
    const signedIn = await page.evaluate(
      async ({ email, password }) => {
        await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.split("=")
          .slice(1)
          .join("=");
        const res = await fetch("/api/v1/auth/login", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(xsrf ? { "X-XSRF-TOKEN": decodeURIComponent(xsrf) } : {}),
          },
          body: JSON.stringify({ email, password, remember: true }),
        });
        return res.ok;
      },
      { email: PERF_EMAIL, password: PERF_PASSWORD },
    );
    if (!signedIn) {
      throw new Error(`Failed to sign in ${PERF_EMAIL} for repeat-load check`);
    }
  }

  // Give SW precache message a moment if needed, then visit every route once to warm cache
  for (const route of ROUTES) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
  }

  // 2. Measure Repeat Load (2nd visit served by Service Worker + browser cache)
  const results = [];
  let failed = false;

  for (const route of ROUTES) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        domInteractive: Math.round(nav.domInteractive),
        loadEventEnd: Math.round(nav.loadEventEnd),
      };
    });
    const ok = timing.domInteractive <= BUDGET_MS;
    if (!ok) failed = true;
    results.push({ route, ...timing, ok });
  }

  await browser.close();

  console.log("NF-4 Repeat Load Results (budget <=", BUDGET_MS, "ms):");
  for (const r of results) {
    console.log(
      `  ${r.ok ? "PASS" : "FAIL"} ${r.route.padEnd(12)} domInteractive=${r.domInteractive}ms  load=${r.loadEventEnd}ms`,
    );
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
