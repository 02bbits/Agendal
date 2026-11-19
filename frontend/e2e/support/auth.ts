import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "./users";
import { open } from "./nav";

export async function signIn(
  page: Page,
  email: string,
  password = PASSWORD,
): Promise<void> {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}

/**
 * Signs out the way a person does (#160): on a wide screen from the sidebar's account menu, on a
 * phone from Settings, opened from the header's Account link.
 */
export async function signOut(page: Page): Promise<void> {
  const accountMenu = page.locator('nav button[aria-haspopup="menu"]');
  if (await accountMenu.isVisible()) {
    await accountMenu.click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
  } else {
    await page.getByRole("link", { name: "Account" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await settings.getByRole("button", { name: "Sign out" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
}
