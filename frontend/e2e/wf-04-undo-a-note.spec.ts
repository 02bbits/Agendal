import { test, expect } from "@playwright/test";
import { signIn } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { resetRateLimits } from "./support/backend";
import { open } from "./support/nav";
import { apply, madeToast, writeNote } from "./support/notes";
import { user } from "./support/users";

test.describe("WF-04: Undo a note", () => {
  test.beforeAll(resetRateLimits);

  test("1. Undo on the toast removes the note's tasks and keeps the note as Pending", async ({
    page,
  }) => {
    await signIn(page, user(15));
    await writeNote(
      page,
      "Book the library room tomorrow. Print the slides tomorrow",
    );
    await apply(page);

    const toast = madeToast(page, 2);
    await expect(toast).toBeVisible();
    await expectNoAxeViolations(page, "Inbox with the note's toast");
    await toast.getByRole("button", { name: "Undo" }).click();

    // Every list follows: Upcoming no longer has the tasks
    await open(page, "/upcoming");
    await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByText("Book the library room")).toHaveCount(0);
    await expect(page.getByText("Print the slides")).toHaveCount(0);

    // The note is kept, Pending
    await open(page, "/notes");
    await page.getByRole("button", { name: "Pending" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Book the library room" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Notes with an undone note");
  });
});
