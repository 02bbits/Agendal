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
    ).toBe("#121211");
  });

  it("leaves System to the device", () => {
    localStorage.setItem("agendal.theme", "system");
    run();

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("does nothing harmful when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    vi.restoreAllMocks();
  });
});
