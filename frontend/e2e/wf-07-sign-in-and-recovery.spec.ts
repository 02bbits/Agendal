import { test, expect } from "@playwright/test";
import { signIn, signOut } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { resetRateLimits } from "./support/backend";
import { open } from "./support/nav";
import { codeFrom, latestMessageTo, linkFrom } from "./support/mailpit";
import { PASSWORD, user } from "./support/users";

test.describe("WF-07: Sign In and Recovery", () => {
  test.beforeAll(resetRateLimits);

  test("1. Sign in with correct details opens Inbox", async ({ page }) => {
    await open(page, "/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await expectNoAxeViolations(page, "Sign in empty");

    await page.getByLabel("Email").fill(user(1));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expectNoAxeViolations(page, "Inbox");
  });

  test("2. Wrong password shows the incorrect-details error", async ({
    page,
  }) => {
    await open(page, "/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.getByLabel("Email").fill(user(2));
    await page
      .getByLabel("Password", { exact: true })
      .fill("Incorrect password 123");
    await page.getByRole("button", { name: "Sign in" }).click();

    const errorAlert = page.getByText("Email or password is incorrect.");
    await expect(errorAlert).toBeVisible();

    // AA §2.2: password cleared and focused, email kept
    await expect(page.getByLabel("Email")).toHaveValue(user(2));
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();

    await expectNoAxeViolations(page, "Sign in incorrect details error");
  });

  test("3. Repeated wrong passwords hit the sign-in limit", async ({
    page,
  }) => {
    await open(page, "/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    const password = page.getByLabel("Password", { exact: true });
    // One attempt = one answer from the server; the old error stays on screen, so
    // wait for the response instead of the message
    const attempt = async (wrong: string, status: number) => {
      await password.fill(wrong);
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/auth/login")),
        page.getByRole("button", { name: "Sign in" }).click(),
      ]);
      expect(response.status()).toBe(status);
    };

    await page.getByLabel("Email").fill(user(3));
    await attempt("Wrong pass 1", 422);
    await expect(
      page.getByText("Email or password is incorrect."),
    ).toBeVisible();
    await attempt("Wrong pass 2", 422);
    // Attempt 3 starts the 60 s lock on the server, but still answers "incorrect"
    await attempt("Wrong pass 3", 422);
    await expect(
      page.getByText("Email or password is incorrect."),
    ).toBeVisible();
    // Attempt 4 is refused with the lockout banner and countdown
    await attempt("Wrong pass 4", 429);

    await expect(page.getByText("Too many attempts")).toBeVisible();
    await expect(page.getByText(/Try again in \d+ s\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  test("4. Forgot password: request link, set new password, sign in works", async ({
    page,
  }) => {
    const targetUser = user(4);
    const newPassword = "New quiet river 99!";

    await open(page, "/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset password" }),
    ).toBeVisible();

    await page.getByLabel("Email").fill(targetUser);
    await page.getByRole("button", { name: "Send link" }).click();

    await expect(page.getByText(/We've sent a link to/)).toBeVisible();
    await expectNoAxeViolations(page, "Forgot password sent");

    const message = await latestMessageTo(targetUser, {
      subject: /Reset your Agendal password/i,
    });
    const resetUrl = linkFrom(message.html, "/reset-password");

    await open(page, resetUrl);
    await expect(
      page.getByRole("heading", { name: "Choose a new password" }),
    ).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(newPassword);
    await page.getByRole("button", { name: "Save password" }).click();

    await expect(
      page.getByRole("heading", { name: "Password changed" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Password changed done state");

    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.getByLabel("Email").fill(targetUser);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("5. Create account: registration, verify email, setup to inbox", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const newEmail = `e2e-new-${timestamp}@example.test`;

    await open(page, "/create-account");
    await expect(
      page.getByRole("heading", { name: "Create account" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Create account empty");

    await page.getByLabel("Email").fill(newEmail);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Verify email");

    const message = await latestMessageTo(newEmail, {
      subject: /verification code/i,
    });
    const code = codeFrom(message.text || message.html);

    await page.getByLabel("Verification code").pressSequentially(code);

    await expect(
      page.getByRole("heading", { name: "Set up Agendal" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "Setup screen");

    // Step 1: Your name
    await page
      .getByRole("textbox", { name: "What should we call you?" })
      .fill("E2E New User");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: Dates and times
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: Security
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(
      page.getByText("Welcome to Agendal. Your account is ready."),
    ).toBeVisible();
  });

  test("6. Sign out from the Account menu returns to Sign in", async ({
    page,
  }) => {
    await signIn(page, user(1));
    await signOut(page);
  });
});
