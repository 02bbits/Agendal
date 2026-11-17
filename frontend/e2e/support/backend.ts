import { execFileSync } from "node:child_process";
import path from "node:path";

const backendDir = path.resolve(__dirname, "../../../backend");

// Every request reaches Laravel from 127.0.0.1, so the per-IP limits (30 sign-ins
// per 10 minutes, 5 new sign-up emails per hour) are shared by every test in a run.
// Clearing the cache (where the rate limiter keeps its counts) before each spec file
// keeps one file's attempts from locking out the next.
export function resetRateLimits(): void {
  execFileSync("php", ["artisan", "cache:clear"], {
    cwd: backendDir,
    stdio: "ignore",
  });
}
