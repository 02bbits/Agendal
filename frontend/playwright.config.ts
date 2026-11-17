import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
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
      },
    },
    {
      command: process.env.CI ? "npm run start" : "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
