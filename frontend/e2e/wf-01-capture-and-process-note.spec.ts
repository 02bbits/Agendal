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

const NOTE =
  "Call the dentist tomorrow at 3pm. Submit the HCI report on Friday. Buy groceries";

test.describe("WF-01: Capture and process a note", () => {
  test.beforeAll(resetRateLimits);

  test("1. The editor opens empty with examples, and Make tasks waits for text", async ({
    page,
  }) => {
    await signIn(page, user(9));
    await page.getByRole("button", { name: "Write a note" }).click();
    const editor = page.getByRole("dialog", { name: "New note" });
    await expect(
      editor.getByRole("textbox", { name: "Your note" }),
    ).toBeFocused();
    await expect(editor.getByText("Try writing")).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Make tasks" }),
    ).toBeDisabled();
    await expectNoAxeViolations(page, "Note editor, empty");

    await editor.getByRole("textbox", { name: "Your note" }).fill("Buy milk");
    await expect(
      editor.getByRole("button", { name: "Make tasks" }),
    ).toBeEnabled();
  });

  test("2. A note with several things becomes one task each, applied from the plan", async ({
    page,
  }) => {
    await signIn(page, user(10));
    await writeNote(page, NOTE);

    // The plan: the note quoted, one NEW row per task, nothing done until Apply
    await expect(reviewScreen(page)).toBeVisible();
    await expect(page.getByRole("blockquote")).toHaveText(NOTE);
    for (const title of [
      "Call the dentist",
      "Submit the HCI report",
      "Buy groceries",
    ])
      await expect(
        page.getByRole("button", { name: new RegExp(`^New: ${title},`) }),
      ).toBeVisible();
    await expectNoAxeViolations(page, "Note plan", [PLAN_ROW_NAMES]);

    await apply(page);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(madeToast(page, 3)).toBeVisible();
    await expect(
      madeToast(page, 3).getByRole("button", { name: "Undo" }),
    ).toBeVisible();
    // A task with no date sits in Inbox's No date group, folded at first
    await page.getByRole("button", { name: /^No date/ }).click();
    await expect(
      page.getByRole("checkbox", { name: "Complete Buy groceries" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Inbox after a note");

    // The note shows in the Notes tab
    await open(page, "/notes");
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(page.getByText("Call the dentist + 2 more")).toBeVisible();
    await expectNoAxeViolations(page, "Notes with a note");
  });
});
