import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { resetRateLimits } from "./support/backend";
import { open } from "./support/nav";
import { createTasks } from "./support/tasks";
import { user } from "./support/users";

/** Inbox again after the tasks were made, so it lists them. */
async function reloadInbox(page: Page) {
  await open(page, "/");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}

const today = (page: Page) => page.getByRole("main");

test.describe("WF-06: Complete a task", () => {
  test.beforeAll(resetRateLimits);

  test("1. Completing a task shows the toast with Undo, and Undo puts it back", async ({
    page,
  }) => {
    await signIn(page, user(5));
    await createTasks(page, [
      { title: "Read chapter 4", due: "today" },
      { title: "Email the tutor", due: "today" },
    ]);
    await reloadInbox(page);
    await expectNoAxeViolations(page, "Inbox with tasks");

    await today(page)
      .getByRole("checkbox", { name: "Complete Read chapter 4" })
      .click();
    await expect(page.getByText("Completed “Read chapter 4”")).toBeVisible();
    await expect(page.getByText("1 of 2 done")).toBeVisible();
    await expectNoAxeViolations(page, "Inbox with the completed toast");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(
      today(page).getByRole("checkbox", { name: "Complete Read chapter 4" }),
    ).toBeVisible();
    await expect(page.getByText("0 of 2 done")).toBeVisible();
  });

  test("2. Completing a repeating task makes its next one", async ({
    page,
  }) => {
    await signIn(page, user(6));
    await createTasks(page, [
      { title: "Daily standup", due: "today", repeat: "daily" },
    ]);
    await reloadInbox(page);

    await today(page)
      .getByRole("checkbox", { name: "Complete Daily standup" })
      .click();
    await expect(page.getByText("Completed “Daily standup”")).toBeVisible();

    // The next one is due tomorrow: Upcoming lists it
    await page
      .getByRole("link", { name: /^Upcoming/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByText("Daily standup").first()).toBeVisible();
    await expectNoAxeViolations(page, "Upcoming with the next occurrence");
  });

  test("3. With everything for today done, Inbox says so and links to Upcoming", async ({
    page,
  }) => {
    await signIn(page, user(7));
    await createTasks(page, [{ title: "Water the plants", due: "today" }]);
    await reloadInbox(page);

    await today(page)
      .getByRole("checkbox", { name: "Complete Water the plants" })
      .click();
    await expect(page.getByText("Nothing left for today")).toBeVisible();
    await expectNoAxeViolations(page, "Inbox with nothing left for today");

    await page
      .getByRole("main")
      .getByRole("link", { name: "See what's coming" })
      .click();
    await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  });
});
