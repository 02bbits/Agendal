import { expect, type Page } from "@playwright/test";

/** Writes a note in the full-screen editor from the capture bar and taps Make tasks. */
export async function writeNote(page: Page, text: string): Promise<void> {
  await page.getByRole("button", { name: "Write a note" }).click();
  const editor = page.getByRole("dialog", { name: "New note" });
  await expect(editor).toBeVisible();
  await editor.getByRole("textbox", { name: "Your note" }).fill(text);
  await editor.getByRole("button", { name: "Make tasks" }).click();
}

/** The note's plan, waiting for Apply (NU-5). */
export function reviewScreen(page: Page) {
  // A page of its own on a phone (h1), the Notes panel beside the list on a wide screen (h2)
  return page.getByRole("heading", { name: /^Review before applying/ });
}

/** Applies the plan; the app goes back to where the note was written. */
export async function apply(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(reviewScreen(page)).toBeHidden();
}

/** The toast after a note is applied, e.g. "2 tasks made", with Undo (WF-04). */
export function madeToast(page: Page, count: number) {
  return page
    .getByRole("status")
    .filter({ hasText: count === 1 ? "1 task made" : `${count} tasks made` });
}

/**
 * The plan's rows name themselves "New: …" while they show "NEW …" and the meta in another
 * order (axe label-content-name-mismatch). The plan screen is RV (Notes), not fixed here.
 */
export const PLAN_ROW_NAMES = {
  rule: "label-content-name-mismatch",
  htmlContains: 'aria-label="New: ',
  reason:
    "the note plan's rows (RV) say New: in another order than they show; reported to the Notes owner",
};
