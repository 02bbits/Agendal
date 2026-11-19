import { test, expect } from "@playwright/test";
import { signIn } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { resetRateLimits } from "./support/backend";
import { open } from "./support/nav";
import {
  apply,
  madeToast,
  PLAN_ROW_NAMES,
  reviewScreen,
  writeNote,
} from "./support/notes";
import { user } from "./support/users";

// An idea, not a task: the note assistant skips it (NU-4)
const IDEA = "idea: try a darker logo";

const followup = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { name: "I couldn't find a task in this note." });

test.describe("WF-03: Resolve an unclear note", () => {
  test.beforeAll(resetRateLimits);

  test("1. Keep it as task plans the whole note as one task, made on Apply", async ({
    page,
  }) => {
    await signIn(page, user(13));
    await writeNote(page, IDEA);

    await expect(followup(page)).toBeVisible();
    await expect(page.getByRole("blockquote")).toHaveText(IDEA);
    await expectNoAxeViolations(page, "Note with no task");

    await page.getByRole("button", { name: "Keep it as task" }).click();
    await expect(reviewScreen(page)).toBeVisible();
    await expectNoAxeViolations(page, "Kept note's plan", [PLAN_ROW_NAMES]);

    await apply(page);
    await expect(madeToast(page, 1)).toBeVisible();
  });

  test("2. Edit the note opens the editor with its text", async ({ page }) => {
    await signIn(page, user(14));
    await writeNote(page, IDEA);
    await expect(followup(page)).toBeVisible();

    await page.getByRole("button", { name: "Edit the note" }).click();
    // The editor, not the Notes panel beside the list on a wide screen
    const editor = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("textbox", { name: "Your note" }) });
    await expect(
      editor.getByRole("textbox", { name: "Your note" }),
    ).toHaveValue(IDEA);
    await expectNoAxeViolations(page, "Editing an unclear note");

    // Closing the editor leaves the note needing a look
    await editor.getByRole("button", { name: "Cancel" }).click();
    await expect(editor).toBeHidden();
    // Closing takes the editor's history entry off a moment later, which can cut a page load short
    await expect(async () => {
      await open(page, "/notes");
    }).toPass();
    await page.getByRole("button", { name: "Pending" }).click();
    await expect(
      page.getByRole("link", { name: /try a darker logo/ }).first(),
    ).toBeVisible();
  });
});
