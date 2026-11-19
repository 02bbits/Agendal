import { test, expect } from "@playwright/test";
import { signIn } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { resetRateLimits } from "./support/backend";
import { open } from "./support/nav";
import {
  apply,
  PLAN_ROW_NAMES,
  reviewScreen,
  writeNote,
} from "./support/notes";
import { createTasks } from "./support/tasks";
import { user } from "./support/users";

test.describe("WF-02: Confirm risky changes", () => {
  test.beforeAll(resetRateLimits);

  test("1. A note that deletes a task waits for Apply, then deletes it with Undo", async ({
    page,
  }) => {
    await signIn(page, user(11));
    await createTasks(page, [{ title: "Buy milk", due: "today" }]);
    await open(page, "/");
    await expect(
      page.getByRole("checkbox", { name: "Complete Buy milk" }),
    ).toBeVisible();

    await writeNote(page, "Delete buy milk");

    // Nothing is applied yet: the plan lists the deletion
    await expect(reviewScreen(page)).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "DELETED" }),
    ).toContainText("Buy milk");
    await expectNoAxeViolations(page, "Plan with a deletion", [PLAN_ROW_NAMES]);

    await apply(page);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Complete Buy milk" }),
    ).toBeHidden();
  });

  test("2. Leaving the plan without Apply changes nothing", async ({
    page,
  }) => {
    await signIn(page, user(12));
    await createTasks(page, [{ title: "Water the plants", due: "today" }]);
    await open(page, "/");

    await writeNote(page, "Delete water the plants");
    await expect(reviewScreen(page)).toBeVisible();

    await open(page, "/");
    await expect(
      page.getByRole("checkbox", { name: "Complete Water the plants" }),
    ).toBeVisible();
  });
});
