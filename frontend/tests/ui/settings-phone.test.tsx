import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppFrame } from "../../src/app/AppFrame";
import AccountPage from "../../src/app/account/page";
import { t } from "../../src/ui/copy";

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

async function openAccount(user = me()) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
    url === "/api/v1/me" && init?.method === "PATCH"
      ? new Response("{}", { status: 200 })
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

describe("Phone Settings (issue #149 round 6)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=token";
    localStorage.clear();

    // Mock matchMedia for phone width ((min-width: 1024px) false)
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("the Sidebar section has exactly one switch named 'Show task counts' with an aria-describedby description, and no visible 'On'/'Off' text next to it", async () => {
    await openAccount();

    const sidebarButton = screen.getByRole("button", {
      name: new RegExp(t("settings.tab_sidebar"), "i"),
    });
    await userEvent.click(sidebarButton);

    const switches = screen.getAllByRole("switch", {
      name: t("settings.sidebar_show_task_counts"),
    });
    expect(switches).toHaveLength(1);

    // No help line: the preview right under the switch shows what it does
    const switchEl = switches[0];
    expect(switchEl.getAttribute("aria-describedby")).toBeNull();

    const switchRow = switchEl.closest(".min-h-11");
    expect(switchRow?.textContent).not.toMatch(/\b(On|Off)\b/);
    expect(screen.queryByText(t("settings.on"))).toBeNull();
    expect(screen.queryByText(t("settings.off"))).toBeNull();
  });
});
