import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import ForgotPasswordPage from "../../src/app/forgot-password/page";
import ResetPasswordPage from "../../src/app/reset-password/page";
import { expectAxeCleanInBothThemes } from "../ui/axe";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/forgot-password";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
// The auth gate's session check answers `session`; every other call gets `reply`
let session: () => Response;
let reply: () => Response;
const callsTo = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => url === `/api/v1${path}`);

function renderAt(path: string, Page: ComponentType) {
  pathname = path;
  return render(
    <AppFrame>
      <Page />
    </AppFrame>,
  );
}

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  session = () => json(401, {});
  reply = () => new Response(null, { status: 202 });
  fetchMock
    .mockReset()
    .mockImplementation(async (url: string) =>
      url === "/api/v1/me" ? session() : reply(),
    );
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=token";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Reset request (AA-4)", () => {
  it("T-AA-30, T-AA-32: confirms the same way for any email, then unlocks Resend after 45 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderAt("/forgot-password", ForgotPasswordPage);
    const send = screen.getByRole("button", { name: "Send link" });

    expect((send as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Email"), " Someone@Gmail.com");
    await user.click(send);

    expect(JSON.parse(callsTo("/auth/forgot-password")[0][1].body)).toEqual({
      email: "someone@gmail.com",
    });
    // Announced politely (the toast region is another status, so find it by text)
    const address = await screen.findByText("someone@gmail.com");
    // The address is bold inside the sentence, which is the polite status
    expect(address.tagName).toBe("STRONG");
    const sent = address.closest("[role=status]");
    expect(sent?.textContent).toBe(
      "We've sent a link to someone@gmail.com. Follow the link to continue resetting your password.",
    );
    // The sent screen drops the subtitle and has no extra hint line (AA §2.3)
    expect(
      screen.queryByText("We'll email you a link to set a new password."),
    ).toBeNull();
    expect(
      screen.queryByText("After you set a new password, sign in with it."),
    ).toBeNull();
    const resend = screen.getByRole("button", {
      name: "Resend link in 45 s",
    }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(45_000));
    expect(resend.textContent).toBe("Resend link");
    expect(resend.disabled).toBe(false);

    await user.click(resend);
    expect(callsTo("/auth/forgot-password")).toHaveLength(2);
  });

  it("Use a different email goes back to the form with the email kept and focused", async () => {
    const user = userEvent.setup();
    renderAt("/forgot-password", ForgotPasswordPage);

    await user.type(screen.getByLabelText("Email"), "exmaple@gmail.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));
    await user.click(
      await screen.findByRole("button", { name: "Use a different email" }),
    );

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.value).toBe("exmaple@gmail.com");
    expect(document.activeElement).toBe(email);
    await user.clear(email);
    await user.type(email, "example@gmail.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    expect(
      callsTo("/auth/forgot-password").map(
        ([, init]) => JSON.parse(init.body).email,
      ),
    ).toEqual(["exmaple@gmail.com", "example@gmail.com"]);
    expect(
      (await screen.findByText("example@gmail.com")).closest("[role=status]")
        ?.textContent,
    ).toContain("We've sent a link to example@gmail.com.");
  });

  it("shows the rate limit with the seconds to wait", async () => {
    reply = () => json(429, {}, { "Retry-After": "900" });
    const user = userEvent.setup();
    renderAt("/forgot-password", ForgotPasswordPage);

    await user.type(screen.getByLabelText("Email"), "example@gmail.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Try again in 900 s.",
    );
  });

  it("is axe-clean in both themes", async () => {
    const { container } = renderAt("/forgot-password", ForgotPasswordPage);
    await expectAxeCleanInBothThemes(container);
  });
});

describe("Set new password (AA §2.3)", () => {
  let linkCount = 0;
  // Each test opens its own link, as a new email would
  function openLink(
    fragment = `token=t${++linkCount}&email=example%40gmail.com`,
  ) {
    window.history.replaceState(null, "", `/reset-password#${fragment}`);
    return renderAt("/reset-password", ResetPasswordPage);
  }

  it("reads the token, removes it from the address bar, and saves the new password, signing nobody in (AA §2.3, T-AA-105)", async () => {
    reply = () => new Response(null, { status: 204 });
    const user = userEvent.setup();
    openLink();

    const field = await screen.findByLabelText("New password");
    expect(window.location.hash).toBe("");
    expect(screen.getByText("For example@gmail.com")).toBeTruthy();
    expect(
      document
        .querySelector('input[autocomplete="username"]')
        ?.getAttribute("value"),
    ).toBe("example@gmail.com");
    await user.type(field, "new river 42");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new river 42",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(JSON.parse(callsTo("/auth/reset-password")[0][1].body)).toEqual({
      token: `t${linkCount}`,
      email: "example@gmail.com",
      password: "new river 42",
    });
    // A done state, not Inbox and not a toast: the user signs in with the new password
    expect(
      (await screen.findByRole("heading", { name: "Password changed" }))
        .textContent,
    ).toBe("Password changed");
    expect(
      screen.getByText(
        "Every device has been signed out. Sign in with your new password.",
      ).textContent,
    ).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });

  it("the done state is axe-clean in both themes", async () => {
    reply = () => new Response(null, { status: 204 });
    const user = userEvent.setup();
    const { container } = openLink();

    await user.type(
      await screen.findByLabelText("New password"),
      "new river 42",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new river 42",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));
    await screen.findByRole("heading", { name: "Password changed" });
    await expectAxeCleanInBothThemes(container);
  });

  it("applies the sign-up rules, including not the email", async () => {
    const user = userEvent.setup();
    openLink();
    const save = screen.getByRole("button", {
      name: "Save password",
    }) as HTMLButtonElement;

    await user.type(
      await screen.findByLabelText("New password"),
      "Example@gmail.com",
    );
    expect(save.disabled).toBe(true);
  });

  it("shows password strength meter and requires matching confirm password", async () => {
    const user = userEvent.setup();
    openLink();

    const newField = await screen.findByLabelText("New password");
    const confirmField = screen.getByLabelText("Confirm new password");
    const saveButton = screen.getByRole("button", {
      name: "Save password",
    }) as HTMLButtonElement;

    // Type new password
    await user.type(newField, "strongSecret99!");
    // Strength meter is present
    expect(document.getElementById("reset-password-strength")).toBeTruthy();
    // Save button disabled because confirm password is empty
    expect(saveButton.disabled).toBe(true);

    // Type mismatched confirm password and blur
    await user.type(confirmField, "differentPassword");
    await user.tab();
    expect(await screen.findByText("New passwords don't match.")).toBeTruthy();
    expect(saveButton.disabled).toBe(true);

    // Type matching confirm password
    await user.clear(confirmField);
    await user.type(confirmField, "strongSecret99!");
    expect(screen.queryByText("New passwords don't match.")).toBeNull();
    expect(saveButton.disabled).toBe(false);
  });

  it("A11Y-62: shows the server's breached-password message on the field and focuses it", async () => {
    const breached =
      "This password has appeared in a data breach. Choose another one.";
    reply = () =>
      json(422, {
        error: {
          code: "auth.password_breached",
          fields: { password: [breached] },
        },
      });
    const user = userEvent.setup();
    openLink();

    const field = await screen.findByLabelText("New password");
    await user.type(field, "password123");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByText(breached)).toBeTruthy();
    expect(document.activeElement).toBe(field);
  });

  it("T-AA-31: an expired or used link offers a new one", async () => {
    reply = () => json(422, { error: { code: "auth.reset_expired" } });
    const user = userEvent.setup();
    openLink();

    await user.type(
      await screen.findByLabelText("New password"),
      "new river 42",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new river 42",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This link has expired or was already used. Request a new one.",
    );
    expect(
      screen
        .getByRole("link", { name: "Request a new link" })
        .getAttribute("href"),
    ).toBe("/forgot-password");
  });

  it("a link without a token shows the expired message straight away", async () => {
    openLink(`nothing=${++linkCount}`);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "This link has expired",
    );
  });

  it("AA-E5: works on a device that is already signed in", async () => {
    session = () => json(200, { id: 1, email: "other@gmail.com" });
    openLink();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.replace).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("New password")).toBeTruthy();
  });

  it("is axe-clean in both themes", async () => {
    const { container } = openLink();
    await screen.findByLabelText("New password");
    await expectAxeCleanInBothThemes(container);
  });
});
