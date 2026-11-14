import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AccountScreen,
  type AccountSettings,
} from "../../src/ui/features/shell/AccountScreen";
import { t } from "../../src/ui/copy";

const defaultSettings: AccountSettings = {
  theme: "system",
  weekStart: "mon",
  timeFormat: "24h",
  rememberDevice: true,
  pageView: "flat",
  timezone: "UTC",
};

describe("Settings on phones (Part D)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockMatchMedia = (matches: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };

  it("profile card shows name and email and opens Account", () => {
    mockMatchMedia(false);
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Profile card displays initial, name and email
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("Alex River")).toBeTruthy();
    expect(screen.getByText("alex@example.com")).toBeTruthy();

    // Clicking profile card opens Account detail view
    const profileCard = screen.getByText("Alex River").closest("button");
    expect(profileCard).toBeTruthy();
    fireEvent.click(profileCard!);

    const detailHeading = screen.getByRole("heading", {
      level: 2,
      name: t("settings.tab_account"),
    });
    expect(detailHeading).toBeTruthy();
  });

  it("PR #153: the name saves only at 3 to 30 characters, and says why otherwise", () => {
    mockMatchMedia(false);
    const onUpdateName = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
        onUpdateName={onUpdateName}
      />,
    );
    fireEvent.click(screen.getByText("Alex River").closest("button")!);
    const input = screen.getByDisplayValue("Alex River");

    fireEvent.change(input, { target: { value: "Al" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe(
      "Use at least 3 characters.",
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(onUpdateName).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  Alex Rivers  " } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(input);
    expect(onUpdateName).toHaveBeenCalledWith("Alex Rivers");
  });

  it("the three group labels render with their rows, and Account is not a row in the groups", () => {
    mockMatchMedia(false);
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Three group labels render
    expect(screen.getByText(t("settings.group_preferences"))).toBeTruthy();
    expect(screen.getByText(t("settings.group_tasks"))).toBeTruthy();
    expect(screen.getByText(t("settings.group_data"))).toBeTruthy();

    // Preferences rows
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("app.tab_general"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_theme"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_sidebar"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_quick_add"), "i"),
      }),
    ).toBeTruthy();

    // Tasks rows
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_productivity"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_reminders"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("app.tab_notifications"), "i"),
      }),
    ).toBeTruthy();

    // Data rows
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_backups"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_integrations"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_calendars"), "i"),
      }),
    ).toBeTruthy();

    // Account is not repeated as a row in the groups
    const accountRowButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === t("settings.tab_account"));
    expect(accountRowButtons).toHaveLength(0);
  });

  it("search shows one card with matches and hides the profile card and groups", () => {
    mockMatchMedia(false);
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("textbox", {
      name: t("settings.search_label"),
    });

    // Search for theme
    fireEvent.change(searchInput, { target: { value: "theme" } });

    // Profile card and group labels are hidden
    expect(screen.queryByText("alex@example.com")).toBeNull();
    expect(screen.queryByText(t("settings.group_preferences"))).toBeNull();
    expect(screen.queryByText(t("settings.group_tasks"))).toBeNull();
    expect(screen.queryByText(t("settings.group_data"))).toBeNull();
    expect(
      screen.queryByRole("button", { name: t("app.sign_out") }),
    ).toBeNull();

    // Matching row is shown
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_theme"), "i"),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("app.tab_general"), "i"),
      }),
    ).toBeNull();

    // Search for account: shows Account row
    fireEvent.change(searchInput, { target: { value: "account" } });
    expect(screen.queryByText("alex@example.com")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_account"), "i"),
      }),
    ).toBeTruthy();

    // Search for empty matches
    fireEvent.change(searchInput, { target: { value: "nonexistentquery123" } });
    expect(screen.getByText(t("settings.none_found"))).toBeTruthy();
  });

  it("Sign out calls the handler", () => {
    mockMatchMedia(false);
    const onSignOut = vi.fn();
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={onSignOut}
      />,
    );

    const signOutBtn = screen.getByRole("button", { name: t("app.sign_out") });
    expect(signOutBtn).toBeTruthy();
    fireEvent.click(signOutBtn);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("the detail header has a back button labelled Back that shows 'Settings' and returns to the list", () => {
    mockMatchMedia(false);
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Tap theme category
    const themeBtn = screen.getByRole("button", {
      name: new RegExp(t("settings.tab_theme"), "i"),
    });
    fireEvent.click(themeBtn);

    // Detail header shows back button with aria-label Back and visible text Settings
    const backBtn = screen.getByRole("button", { name: t("common.back") });
    expect(backBtn).toBeTruthy();
    expect(backBtn.textContent).toContain(t("settings.title"));

    // Detail header has no close button
    expect(
      screen.queryByRole("button", { name: t("common.close") }),
    ).toBeNull();

    // Detail title
    const detailHeading = screen.getByRole("heading", {
      level: 2,
      name: t("settings.tab_theme"),
    });
    expect(detailHeading).toBeTruthy();

    // Tap back button
    fireEvent.click(backBtn);

    // Back in list view
    const listHeading = screen.getByRole("heading", { level: 1 });
    expect(listHeading.textContent).toBe(t("settings.title"));
    expect(screen.queryByRole("button", { name: t("common.back") })).toBeNull();
    // List header has close button
    expect(
      screen.getByRole("button", { name: t("common.close") }),
    ).toBeTruthy();
  });

  it("handles Esc: in detail goes to list, in list closes settings", () => {
    mockMatchMedia(false);
    const onBack = vi.fn();
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={onBack}
        onSignOut={vi.fn()}
      />,
    );

    // Open Theme detail
    const themeBtn = screen.getByRole("button", {
      name: new RegExp(t("settings.tab_theme"), "i"),
    });
    fireEvent.click(themeBtn);

    expect(screen.getByRole("button", { name: t("common.back") })).toBeTruthy();

    // Esc in detail returns to list
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: t("common.back") })).toBeNull();
    expect(onBack).not.toHaveBeenCalled();

    // Esc in list closes settings
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders two-pane desktop layout from md (768px) up", () => {
    mockMatchMedia(true);
    render(
      <AccountScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Backdrop is present on desktop
    expect(screen.getByTestId("settings-backdrop")).toBeTruthy();
    // Desktop radiogroup navigation is present
    expect(
      screen.getByRole("radiogroup", { name: t("settings.nav_label") }),
    ).toBeTruthy();
  });
});
