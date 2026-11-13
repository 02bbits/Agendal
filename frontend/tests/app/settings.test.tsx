import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import AccountPage from "../../src/app/account/page";

// IM-16: Account settings load from GET /me and save with PATCH /me (AP-3, AP-5)
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
  useRouter: () => router,
}));

const me = (extra = {}) => ({
  id: 1,
  email: "ann@example.com",
  display_name: "Ann",
  theme: "system",
  week_start: "mon",
  time_format: "24h",
  remember_device: true,
  ...extra,
});

const fetchMock = vi.fn();
let patchStatus = 200;
const patches = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PATCH")
    .map(([url, init]) => [url, JSON.parse(init.body)]);

async function openAccount(user = me()) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
    url === "/api/v1/me" && init?.method === "PATCH"
      ? new Response("{}", { status: patchStatus })
      : url === "/api/v1/me"
        ? new Response(JSON.stringify(user), { status: 200 })
        : new Response(null, { status: 204 }),
  );
  render(
    <AppFrame>
      <AccountPage />
    </AppFrame>,
  );
  await screen.findByText("ann@example.com");
}
const radio = (name: string) => screen.getByRole("radio", { name });

beforeEach(() => {
  patchStatus = 200;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=token";
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("Account settings (AP-3, AP-5)", () => {
  it("T-AP-21, T-AP-50: shows the settings the server holds", async () => {
    await openAccount(
      me({ theme: "dark", week_start: "sun", time_format: "12h" }),
    );

    expect(radio("Dark").getAttribute("aria-checked")).toBe("true");
    expect(radio("Sunday").getAttribute("aria-checked")).toBe("true");
    expect(radio("12-hour").getAttribute("aria-checked")).toBe("true");
    // The theme is applied in an effect, which can run just after the text appears
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "agendal-dark",
      ),
    );
  });

  it("T-AP-21, T-AP-50: a change applies at once and is saved with PATCH /me", async () => {
    await openAccount();
    await userEvent.click(radio("Dark"));
    await userEvent.click(radio("Sunday"));
    await userEvent.click(radio("12-hour"));

    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "agendal-dark",
    );
    expect(patches()).toEqual([
      ["/api/v1/me", { theme: "dark" }],
      ["/api/v1/me", { week_start: "sun" }],
      ["/api/v1/me", { time_format: "12h" }],
    ]);
  });

  it("T-AP-20: System follows the device, so no data-theme is set", async () => {
    await openAccount(me({ theme: "dark" }));
    await userEvent.click(radio("System"));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("agendal.theme")).toBe("system");
  });

  it("a session check that answers after a change doesn't undo it", async () => {
    let answer!: () => void;
    const late = new Promise<void>((resolve) => (answer = resolve));
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url !== "/api/v1/me") return new Response(null, { status: 204 });
      if (init?.method === "PATCH") return new Response("{}", { status: 200 });
      await late;
      return new Response(JSON.stringify(me()), { status: 200 });
    });
    render(
      <AppFrame>
        <AccountPage />
      </AppFrame>,
    );
    await userEvent.click(radio("Dark"));
    answer();

    await screen.findByText("ann@example.com");
    expect(radio("Dark").getAttribute("aria-checked")).toBe("true");
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe(
        "agendal-dark",
      ),
    );
  });

  it("applies a change even when the session check can't answer", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me") throw new TypeError("Failed to fetch");
      return new Response(null, { status: 204 });
    });
    render(
      <AppFrame>
        <AccountPage />
      </AppFrame>,
    );
    await userEvent.click(radio("Dark"));

    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "agendal-dark",
    );
    expect(localStorage.getItem("agendal.theme")).toBe("dark");
  });

  it("puts the old value back and says so when the save is refused", async () => {
    patchStatus = 500;
    await openAccount();
    await userEvent.click(radio("Dark"));

    await waitFor(() =>
      expect(radio("System").getAttribute("aria-checked")).toBe("true"),
    );
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
  });

  it("allows enabling and disabling sidebar navigation tabs via checkboxes", async () => {
    await openAccount();
    await userEvent.click(radio("Sidebar"));

    const upcomingCheckbox = screen.getByRole("checkbox", {
      name: "Upcoming",
    }) as HTMLInputElement;
    expect(upcomingCheckbox.checked).toBe(true);

    await userEvent.click(upcomingCheckbox);
    expect(upcomingCheckbox.checked).toBe(false);

    const stored = JSON.parse(
      localStorage.getItem("agendal.sidebar_tabs_enabled") || "{}",
    );
    expect(stored.upcoming).toBe(false);
  });

  it("allows reordering sidebar tabs with move buttons and resetting to default", async () => {
    await openAccount();
    await userEvent.click(radio("Sidebar"));

    const moveDownInbox = screen.getByRole("button", {
      name: "Move down: Inbox",
    });
    await userEvent.click(moveDownInbox);

    const storedOrder = JSON.parse(
      localStorage.getItem("agendal.sidebar_tabs_order") || "[]",
    );
    expect(storedOrder[0]).not.toBe("inbox");
    expect(storedOrder[1]).toBe("inbox");

    const resetButton = screen.getByRole("button", {
      name: "Reset to default",
    });
    await userEvent.click(resetButton);

    const resetOrder = JSON.parse(
      localStorage.getItem("agendal.sidebar_tabs_order") || "[]",
    );
    expect(resetOrder).toEqual(["inbox", "upcoming", "projects", "notes"]);
  });

  it("renders backdrop with blur and prevents background scrolling", async () => {
    await openAccount();

    const backdrop = screen.getByTestId("settings-backdrop");
    expect(backdrop).toBeTruthy();
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.className).toContain("backdrop-blur-[2px]");
    expect(backdrop.className).toContain("bg-scrim/60");

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.className).toContain("overscroll-contain");

    const preventDefault = vi.fn();
    backdrop.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true }),
    );
    const touchEvent = new Event("touchmove", {
      bubbles: true,
      cancelable: true,
    });
    touchEvent.preventDefault = preventDefault;
    backdrop.dispatchEvent(touchEvent);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("shows 2FA switch; toggle ON calls API and toasts", async () => {
    let twoFactorCall: unknown = null;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/auth/two-factor" && init?.method === "POST") {
        twoFactorCall = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({ user: me({ two_factor_enabled: true }) }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (url === "/api/v1/me") {
        return new Response(JSON.stringify(me({ two_factor_enabled: false })), {
          status: 200,
        });
      }
      return new Response(null, { status: 204 });
    });

    render(
      <AppFrame>
        <AccountPage />
      </AppFrame>,
    );
    await screen.findByText("ann@example.com");

    const twoFactorSwitch = screen.getByRole("switch", {
      name: "Email me a code at sign-in",
    });
    expect(twoFactorSwitch.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(twoFactorSwitch);

    expect(twoFactorCall).toEqual({ enabled: true });
    expect(
      await screen.findByText("Two-step verification is on."),
    ).toBeTruthy();
    expect(twoFactorSwitch.getAttribute("aria-checked")).toBe("true");
  });

  it("toggle OFF opens dialog, wrong password shows error, correct password calls API, closes dialog, toasts", async () => {
    let twoFactorCall: unknown = null;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/auth/two-factor" && init?.method === "POST") {
        twoFactorCall = JSON.parse(init.body as string);
        if (
          (twoFactorCall as { current_password?: string }).current_password ===
          "wrong"
        ) {
          return new Response(
            JSON.stringify({
              error: {
                code: "auth.current_password_wrong",
                message: "That's not your current password.",
              },
            }),
            { status: 422, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ user: me({ two_factor_enabled: false }) }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/v1/me") {
        return new Response(JSON.stringify(me({ two_factor_enabled: true })), {
          status: 200,
        });
      }
      return new Response(null, { status: 204 });
    });

    render(
      <AppFrame>
        <AccountPage />
      </AppFrame>,
    );
    await screen.findByText("ann@example.com");

    const twoFactorSwitch = screen.getByRole("switch", {
      name: "Email me a code at sign-in",
    });
    expect(twoFactorSwitch.getAttribute("aria-checked")).toBe("true");

    // Click to turn OFF
    await userEvent.click(twoFactorSwitch);

    // Dialog opens
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Turn off two-step verification?" }),
    ).toBeTruthy();

    const passwordInput = screen.getByLabelText("Current password");
    const confirmButton = screen.getByRole("button", { name: "Turn off" });

    // Enter wrong password
    await userEvent.type(passwordInput, "wrong");
    await userEvent.click(confirmButton);

    expect(
      await screen.findByText("That's not your current password."),
    ).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).not.toBeNull();

    // Enter correct password
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, "correct-pass");
    await userEvent.click(confirmButton);

    expect(twoFactorCall).toEqual({
      enabled: false,
      current_password: "correct-pass",
    });

    // Dialog closes
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    expect(
      await screen.findByText("Two-step verification is off."),
    ).toBeTruthy();
    expect(twoFactorSwitch.getAttribute("aria-checked")).toBe("false");
  });

  it("/me with theme_palette: lavender, page_view: full sets primary color and page-view and shows in settings", async () => {
    await openAccount(me({ theme_palette: "lavender", page_view: "full" }));

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--color-primary"),
      ).toBe("#8c52ff");
      expect(document.documentElement.getAttribute("data-page-view")).toBe(
        "full",
      );
    });
    expect(screen.getByRole("button", { name: /Full width/i })).toBeTruthy();
  });

  it("picking a palette in Settings sends PATCH /me with theme_palette and picking Full width sends page_view: full", async () => {
    await openAccount(me({ page_view: "flat", theme_palette: "default" }));

    // Click Lavender palette card
    const lavenderCard = screen
      .getByText("Lavender")
      .closest("div[class*='cursor-pointer']")!;
    await userEvent.click(lavenderCard);

    expect(patches()).toContainEqual([
      "/api/v1/me",
      { theme_palette: "lavender" },
    ]);
    expect(
      document.documentElement.style.getPropertyValue("--color-primary"),
    ).toBe("#8c52ff");

    // Open Page view dropdown and pick Full width
    const pageViewDropdown = screen.getByRole("button", {
      name: /Flat view/i,
    });
    await userEvent.click(pageViewDropdown);
    const fullOption = screen.getByRole("radio", { name: "Full width" });
    await userEvent.click(fullOption);

    expect(patches()).toContainEqual(["/api/v1/me", { page_view: "full" }]);
    expect(document.documentElement.getAttribute("data-page-view")).toBe(
      "full",
    );
  });
});

describe("theme.js (T-AP-22)", () => {
  const run = () =>
    new Function(readFileSync("public/theme.js", "utf8"))() as void;
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.head.querySelector('meta[name="theme-color"]')?.remove();
  });

  it("sets the stored theme and the browser colour before anything renders", () => {
    localStorage.setItem("agendal.theme", "dark");
    run();

    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "agendal-dark",
    );
    expect(
      document.head
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe("#1a1a1a");
  });

  it("leaves System to the device", () => {
    localStorage.setItem("agendal.theme", "system");
    run();

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("sets the stored theme palette on html style before anything renders", () => {
    localStorage.setItem("agendal.theme_palette", "lavender");
    run();

    expect(
      document.documentElement.style.getPropertyValue("--color-primary"),
    ).toBe("#8c52ff");
    expect(
      document.documentElement.style.getPropertyValue("--color-primary-tint"),
    ).toBe("#8c52ff22");
  });

  it("does nothing harmful when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    vi.restoreAllMocks();
  });
});
