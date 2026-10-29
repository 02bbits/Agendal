import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import CreateAccountPage from "../../src/app/create-account/page";
import { signUpErrors } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "../ui/axe";

const router = { push: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/create-account",
  useRouter: () => router,
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function renderPage() {
  render(
    <AppFrame>
      <CreateAccountPage />
    </AppFrame>,
  );
  return {
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Create account" }),
  };
}

beforeEach(() => {
  router.push.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=token";
});
afterEach(() => vi.unstubAllGlobals());

describe("T-AA-01: client rules", () => {
  it.each([
    ["example@gmail.com", "quiet river", {}],
    ["not-an-email", "quiet river", { email: "auth.email_invalid" }],
    ["example@gmail.com", "seven77", { password: "auth.password_rule" }],
    ["example@gmail.com", "x".repeat(129), { password: "auth.password_rule" }],
    ["example@gmail.com", "🙂 ab".repeat(32), {}],
    [
      " Example@Gmail.com",
      "EXAMPLE@gmail.com",
      { password: "auth.password_same_as_email" },
    ],
  ])("%s / %s", (email, password, expected) => {
    expect(signUpErrors(email, password)).toEqual(expected);
  });
});

describe("Create account (AA-1)", () => {
  it("T-AA-04: Create account stays disabled until both fields are valid", async () => {
    const user = userEvent.setup();
    const { email, password, submit } = renderPage();

    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.type(email, "example@gmail.com");
    await user.type(password, "short");
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.type(password, " but fine");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("T-AA-05: success opens Inbox with the welcome toast", async () => {
    fetchMock.mockResolvedValue(json(201, { user: {} }));
    const user = userEvent.setup();
    const { email, password, submit } = renderPage();

    await user.type(email, "  Example@Gmail.com");
    await user.type(password, "quiet river 42");
    await user.click(submit);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/register");
    expect(JSON.parse(init.body)).toMatchObject({
      email: "example@gmail.com",
      password: "quiet river 42",
    });
    expect(router.push).toHaveBeenCalledWith("/");
    expect(
      await screen.findByText("Welcome to Agendal. Your account is ready."),
    ).toBeTruthy();
  });

  it("shows the server's field error with a Sign in link and focuses the field", async () => {
    const taken = "An account with this email already exists. Sign in instead?";
    fetchMock.mockResolvedValue(
      json(422, {
        error: { code: "auth.email_taken", fields: { email: [taken] } },
      }),
    );
    const user = userEvent.setup();
    const { email, password, submit } = renderPage();

    await user.type(email, "example@gmail.com");
    await user.type(password, "quiet river 42");
    await user.click(submit);

    expect(await screen.findByText(taken)).toBeTruthy();
    expect(document.activeElement).toBe(email);
    expect(
      screen.getAllByRole("link", { name: "Sign in" })[0].getAttribute("href"),
    ).toBe("/sign-in");
  });

  it("shows the rate limit with the seconds to wait", async () => {
    fetchMock.mockResolvedValue(json(429, {}, { "Retry-After": "120" }));
    const user = userEvent.setup();
    const { email, password, submit } = renderPage();

    await user.type(email, "example@gmail.com");
    await user.type(password, "quiet river 42");
    await user.click(submit);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Try again in 120 s.",
    );
  });

  it("A11Y-60: show/hide is a pressed toggle", async () => {
    const user = userEvent.setup();
    const { password } = renderPage();
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(password.getAttribute("type")).toBe("password");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(password.getAttribute("type")).toBe("text");
  });

  it("is axe-clean in both themes", async () => {
    const { container } = render(
      <AppFrame>
        <CreateAccountPage />
      </AppFrame>,
    );
    await expectAxeCleanInBothThemes(container);
  });
});
