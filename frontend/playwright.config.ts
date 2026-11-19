import { defineConfig, devices } from "@playwright/test";

// The app under test. CI serves the production build on :3000. Locally the service worker
// (IM-50 and on) only runs in a build, so point this at one, e.g. `next start -p 3001`
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    {
      name: "chromium-phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "webkit-phone",
      use: {
        ...devices["iPhone 13"],
      },
    },
    {
      name: "webkit-desktop",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      // PHP's own server, not `artisan serve`: artisan drops most environment
      // variables before starting PHP, so the overrides below would not reach Laravel.
      command:
        "php -S 127.0.0.1:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php",
      cwd: "../backend/public",
      url: "http://127.0.0.1:8000/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        // WebKit drops Secure cookies on http://localhost, so the session would never
        // stick. A __Host- cookie must be Secure, so the name changes with it.
        SESSION_SECURE_COOKIE: "false",
        SESSION_COOKIE: "agendal_e2e_session",
        QUEUE_CONNECTION: "sync",
        // The build on :3001 (local service worker checks) signs in through Sanctum too
        SANCTUM_STATEFUL_DOMAINS: "localhost:3000,localhost:3001",
      },
    },
    {
      command: process.env.CI ? "npm run start" : "npm run dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
