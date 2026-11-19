import { test } from "@playwright/test";

// E2eSeeder creates e2e-01 … e2e-80. Each Playwright project gets its own
// block of 20 so a run on one browser never sees another browser's changes
// (a locked account, a reset password):
//   chromium-phone 01–20, chromium-desktop 21–40, webkit-phone 41–60, webkit-desktop 61–80.
// Inside a block, each spec file uses fixed numbers:
//   WF-07: 1–4, WF-06: 5–8, WF-01..04: 9–16, WF-05: 17, spare: 18–20.
export const PROJECTS = [
  "chromium-phone",
  "chromium-desktop",
  "webkit-phone",
  "webkit-desktop",
] as const;

export const USERS_PER_PROJECT = 20;

export const PASSWORD = process.env.E2E_PASSWORD ?? "E2e quiet river 42";

export function user(n: number): string {
  if (n < 1 || n > USERS_PER_PROJECT) throw new Error(`No E2E user ${n}`);
  const project = test.info().project.name;
  const block = PROJECTS.indexOf(project as (typeof PROJECTS)[number]);
  if (block < 0) throw new Error(`Unknown Playwright project ${project}`);
  const number = block * USERS_PER_PROJECT + n;
  return `e2e-${String(number).padStart(2, "0")}@example.test`;
}
