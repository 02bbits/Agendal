import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { resetRateLimits } from "./support/backend";
import { open } from "./support/nav";
import { user } from "./support/users";

/** The service worker runs only in a production build (IM-50): CI's, or one on :3001 locally. */
async function serviceWorkerReady(page: Page) {
  const ready = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const timeout = new Promise<false>((resolve) =>
      setTimeout(() => resolve(false), 15_000),
    );
    return Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      timeout,
    ]);
  });
  test.skip(!ready, "No service worker: run against a production build");
}

test.describe("WF-05: Offline capture and sync", () => {
  test.beforeAll(resetRateLimits);

  test("1. Offline, a note is saved on the device and sent on reconnect", async ({
    page,
    context,
  }) => {
    await signIn(page, user(17));
    await serviceWorkerReady(page);
    // Once more with the worker in control, so Inbox comes from its cache offline
    await open(page, "/");

    await context.setOffline(true);
    await expect(page.getByText("You're offline").first()).toBeVisible();
    await expectNoAxeViolations(page, "Inbox offline");

    // The editor saves instead of making tasks
    await page.getByRole("button", { name: "Write a note" }).click();
    const editor = page.getByRole("dialog", { name: "New note" });
    await editor
      .getByRole("textbox", { name: "Your note" })
      .fill("Return the library books tomorrow. Call the bank tomorrow");
    await editor.getByRole("button", { name: "Save note" }).click();
    await expect(
      page.getByText("Saved. It'll turn into tasks when you're back online."),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /^Notes/ })
      .first()
      .click();
    await expect(
      page.getByText("Waiting for connection").first(),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Notes with a note waiting offline");

    // Back online: the note goes to the server and waits for its review (every plan is
    // reviewed before it applies), so it no longer waits for a connection
    await context.setOffline(false);
    await expect(page.getByText("You're offline")).toHaveCount(0);
    await expect(page.getByText("Waiting for connection")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Return the library books" }),
    ).toContainText("Pending");
  });
});
