import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import SignInPage from "../../src/app/sign-in/page";
import { safeReturnPath } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "../ui/axe";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/sign-in",
  useRouter: () => router,
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
// The auth gate's session check answers `session`; every other call gets `reply`
let session: () => Response;
let reply: () => Response;

function renderPage() {
  const view = render(
    <AppFrame>
      <SignInPage />
    </AppFrame>,
  );
  return {
    view,
    email: screen.getByLabelText("Email") as HTMLInputElement,
    password: screen.getByLabelText("Password") as HTMLInputElement,
    submit: screen.getByRole("button", {
      name: "Sign in",
    }) as HTMLButtonElement,
  };
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  const fields = renderPage();
  await user.type(fields.email, "example@gmail.com");
  await user.type(fields.password, "quiet river 42");
  await user.click(fields.submit);
  return fields;
}

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  session = () => json(401, {});
  reply = () => json(200, { user: {} });
  fetchMock
    .mockReset()
    .mockImplementation(async (url: string) =>
      url === "/api/v1/me" ? session() : reply(),
    );
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=token";
  sessionStorage.clear();
  window.history.replaceState(null, "", "/sign-in");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Sign in (AA-2)", () => {
  it("T-AA-112: enables Sign in once both fields have text, including from autofill's input events", async () => {
    const { email, password, submit } = renderPage();

    // A password manager sets the value and fires `input`, with no keystrokes (AA-E12)
    expect(submit.disabled).toBe(true);
    fireEvent.input(email, { target: { value: "example@gmail.com" } });
    expect(submit.disabled).toBe(true);
    fireEvent.input(password, { target: { value: "x" } });
    expect(submit.disabled).toBe(false);
  });

  it("sends the email lower-cased, the password and Remember me (on by default)", async () => {
    const user = userEvent.setup();
    renderPage();
    const checkbox = screen.getByRole("checkbox", { name: "Remember me" });
    expect((checkbox as HTMLInputElement).checked).toBe(true);

    await user.type(screen.getByLabelText("Email"), " Example@Gmail.com");
    await user.type(screen.getByLabelText("Password"), "quiet river 42");
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const [, init] = fetchMock.mock.calls.find(
      ([url]) => url === "/api/v1/auth/login",
    )!;
    expect(JSON.parse(init.body)).toEqual({
      email: "example@gmail.com",
      password: "quiet river 42",
      remember: false,
    });
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("T-AA-11, A11Y-60: show/hide is a pressed toggle", async () => {
    const user = userEvent.setup();
    const { password } = renderPage();
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(toggle.getAttribute("tabindex")).toBe("-1");
    expect(password.getAttribute("aria-keyshortcuts")).toBe("Alt+F8");

    await user.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(password.type).toBe("text");

    password.focus();
    await user.keyboard("{Alt>}{F8}{/Alt}");
    expect(password.type).toBe("password");
  });

  it("T-AA-10, A11Y-62: wrong details show auth.invalid, keep the email, clear and focus the password", async () => {
    reply = () => json(422, { error: { code: "auth.invalid" } });
    const user = userEvent.setup();
    const { email, password } = await signIn(user);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Email or password is incorrect.",
    );
    expect(email.value).toBe("example@gmail.com");
    expect(password.value).toBe("");
    expect(document.activeElement).toBe(password);
  });

  it("AA §2.10: a wrong password typed with accents is still sent, and the error adds the Vietnamese typing hint", async () => {
    reply = () => json(422, { error: { code: "auth.invalid" } });
    const user = userEvent.setup();
    const fields = renderPage();
    await user.type(fields.email, "example@gmail.com");
    await user.type(fields.password, "mật khẩu 123");
    await user.click(fields.submit);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Email or password is incorrect. Your password has accented letters: check that Vietnamese typing is off.",
    );
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/v1/auth/login"),
    ).toBe(true);
  });

  it("T-AA-111, SEC-24: goes back to a same-origin return path, never another site", async () => {
    window.history.replaceState(null, "", "/sign-in?next=%2Fupcoming");
    await signIn(userEvent.setup());
    expect(router.push).toHaveBeenLastCalledWith("/upcoming");

    expect(safeReturnPath("//evil.com")).toBe("/");
    expect(safeReturnPath("/\\evil.com")).toBe("/");
    expect(safeReturnPath("/\t/evil.com")).toBe("/");
    expect(safeReturnPath("https://evil.com")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath("/projects/1?x=2")).toBe("/projects/1?x=2");
  });

  it("renders Remember me and Forgot password in one row", () => {
    renderPage();
    const checkbox = screen.getByRole("checkbox", { name: "Remember me" });
    const forgotLink = screen.getByRole("link", { name: "Forgot password?" });
    const row = checkbox.closest("div.flex");
    expect(row).toBeTruthy();
    expect(row?.contains(checkbox)).toBe(true);
    expect(row?.contains(forgotLink)).toBe(true);
  });

  it("is axe-clean in both themes", async () => {
    const { view } = renderPage();
    await expectAxeCleanInBothThemes(view.container);
  });
});

describe("Lockout (AA-3)", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it("T-AA-20: shows Too many attempts and counts down 60 s before Sign in works again", async () => {
    reply = () =>
      json(429, { error: { code: "auth.locked", retry_after: 60 } });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { submit } = await signIn(user);

    expect(await screen.findByText("Too many attempts")).toBeTruthy();
    expect(screen.getByText("Try again in 60 s.")).toBeTruthy();
    expect(submit.disabled).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("Try again in 30 s.")).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(31_000));
    expect(screen.queryByText("Too many attempts")).toBeNull();
    expect(submit.disabled).toBe(false);
    // Announced once, in a polite live region (A11Y-61)
    expect(
      screen.getByText("You can sign in again.").getAttribute("role"),
    ).toBe("status");
  });

  it("T-AA-103: a reload carries on with the same countdown", () => {
    sessionStorage.setItem(
      "agendal.sign_in_locked_until",
      String(Date.now() + 42_000),
    );
    renderPage();

    expect(screen.getByText("Try again in 42 s.")).toBeTruthy();
  });
});

describe("Two-factor authentication (issue #149 C)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("shows 2FA challenge on 202, signs in on correct code", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/me") return session();
      if (url === "/api/v1/auth/login") {
        return json(202, {
          two_factor: true,
          email: "e******@gmail.com",
        });
      }
      if (url === "/api/v1/auth/two-factor/challenge") {
        const body = JSON.parse(init?.body as string);
        expect(body.code).toBe("123456");
        return json(200, { user: { id: 1, email: "example@gmail.com" } });
      }
      return reply();
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signIn(user);

    expect(await screen.findByText("Enter your sign-in code")).toBeTruthy();
    expect(screen.getByText(/We sent a 6-digit code to/)).toBeTruthy();
    expect(screen.getByText("e******@gmail.com")).toBeTruthy();

    const input = screen.getByRole("textbox", { name: "Verification code" });
    for (const d of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.keyDown(input, { key: d });
    }

    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("wrong code shows error under slots", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me") return session();
      if (url === "/api/v1/auth/login") {
        return json(202, {
          two_factor: true,
          email: "e******@gmail.com",
        });
      }
      if (url === "/api/v1/auth/two-factor/challenge") {
        return json(422, {
          error: {
            code: "auth.two_factor_wrong",
            message: "That code isn't right. Try again.",
          },
        });
      }
      return reply();
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signIn(user);

    await screen.findByText("Enter your sign-in code");
    const input = screen.getByRole("textbox", { name: "Verification code" });
    for (const d of ["0", "0", "0", "0", "0", "0"]) {
      fireEvent.keyDown(input, { key: d });
    }

    expect(
      await screen.findByText("That code isn't right. Try again."),
    ).toBeTruthy();
  });

  it("Use a different account returns to password form", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me") return session();
      if (url === "/api/v1/auth/login") {
        return json(202, {
          two_factor: true,
          email: "e******@gmail.com",
        });
      }
      return reply();
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signIn(user);

    await screen.findByText("Enter your sign-in code");
    const backBtn = screen.getByRole("button", {
      name: "Use a different account",
    });
    await user.click(backBtn);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("expired pending session redirects to password form with error", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me") return session();
      if (url === "/api/v1/auth/login") {
        return json(202, {
          two_factor: true,
          email: "e******@gmail.com",
        });
      }
      if (url === "/api/v1/auth/two-factor/challenge") {
        return json(422, {
          error: {
            code: "auth.two_factor_expired",
            message: "This sign-in has expired. Sign in again.",
          },
        });
      }
      return reply();
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signIn(user);

    await screen.findByText("Enter your sign-in code");
    const input = screen.getByRole("textbox", { name: "Verification code" });
    for (const d of ["9", "9", "9", "9", "9", "9"]) {
      fireEvent.keyDown(input, { key: d });
    }

    expect(
      await screen.findByText("This sign-in has expired. Sign in again."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});

it("sends a signed-in visitor to Inbox", async () => {
  session = () => json(200, { id: 1, email: "example@gmail.com" });
  renderPage();

  await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
});
