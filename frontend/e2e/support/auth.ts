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

export async function signOut(page: Page): Promise<void> {
  // Real Account menu path
  await page.getByRole("link", { name: /Account/i }).click();

  // Switch to Account tab
  const accountTab = page.getByRole("radio", { name: /^Account$/i });
  await expect(accountTab).toBeVisible();
  await accountTab.click();

  // Click Sign out button
  const signOutBtn = page.getByRole("button", { name: /^Sign out$/i });
  await expect(signOutBtn).toBeVisible();
  await signOutBtn.click();

  // Assert return to Sign in screen
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
}
