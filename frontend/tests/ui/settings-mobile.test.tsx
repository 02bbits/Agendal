import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SettingsScreen, type AccountSettings } from "../../src/ui";
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

  it("#168: Settings has one Sign out with its icon; it asks, with Sign out on all devices as a checkbox", () => {
    for (const wide of [false, true]) {
      mockMatchMedia(wide);
      const onSignOut = vi.fn();
      const onSignOutEverywhere = vi.fn();
      const { unmount } = render(
        <SettingsScreen
          name="Alex River"
          email="alex@example.com"
          settings={defaultSettings}
          onChange={vi.fn()}
          onBack={vi.fn()}
          onSignOut={onSignOut}
          onSignOutEverywhere={onSignOutEverywhere}
          initialTab="account"
        />,
      );
      const signOut = screen.getByRole("button", { name: "Sign out" });
      expect(signOut.querySelector("svg")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Sign out on all devices" }),
      ).toBeNull();
      fireEvent.click(signOut);
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(
        within(dialog).getByRole("checkbox", {
          name: "Sign out on all devices",
        }),
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
      expect(onSignOutEverywhere).toHaveBeenCalledTimes(1);
      expect(onSignOut).not.toHaveBeenCalled();

      // The Account page itself has no sign-out buttons any more
      if (!wide) {
        fireEvent.click(screen.getByText("Alex River").closest("button")!);
        expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
      }
      unmount();
    }
  });

  it("profile card shows name and email and opens Account", () => {
    mockMatchMedia(false);
    render(
      <SettingsScreen
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
      <SettingsScreen
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

  it("the group labels render with their rows, and Account is not a row in the groups", () => {
    mockMatchMedia(false);
    render(
      <SettingsScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Group labels render (Data group is omitted when backups/integrations/calendars are removed)
    expect(screen.getByText(t("settings.group_preferences"))).toBeTruthy();
    expect(screen.queryByText(t("settings.group_tasks"))).toBeNull();
    expect(screen.queryByText("Data and apps")).toBeNull();

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
    // Sidebar settings only change the desktop sidebar, so phones don't list them
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("settings.tab_sidebar"), "i"),
      }),
    ).toBeNull();

    // Reminders tab is present (TK-6, #186)
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("settings.tab_reminders"), "i"),
      }),
    ).toBeTruthy();

    // Legacy Notifications tab is gone
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("app.tab_notifications"), "i"),
      }),
    ).toBeNull();

    // Removed tabs are not present
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("settings.tab_quick_add"), "i"),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("settings.tab_productivity"), "i"),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("settings.tab_backups"), "i"),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("settings.tab_integrations"), "i"),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(t("settings.tab_calendars"), "i"),
      }),
    ).toBeNull();

    // Account is not repeated as a row in the groups
    const accountRowButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === t("settings.tab_account"));
    expect(accountRowButtons).toHaveLength(0);
  });

  it("search shows one card with matches and hides the profile card and groups", () => {
    mockMatchMedia(false);
    render(
      <SettingsScreen
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
    expect(screen.queryByText("Data and apps")).toBeNull();
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
      <SettingsScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={onSignOut}
      />,
    );

    const signOutBtn = screen.getByRole("button", { name: t("app.sign_out") });
    fireEvent.click(signOutBtn);
    // It asks first (#168)
    expect(onSignOut).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: t("app.sign_out"),
      }),
    );
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("the detail header has a back button labelled Back that shows 'Settings' and returns to the list", () => {
    mockMatchMedia(false);
    render(
      <SettingsScreen
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
    // The list header has "‹ Back" (it leaves Settings) instead of a close button
    const leave = screen.getByRole("button", { name: t("common.back") });
    expect(leave.textContent).toBe(t("common.back"));
    expect(
      screen.queryByRole("button", { name: t("common.close") }),
    ).toBeNull();
  });

  it("handles Esc: in detail goes to list, in list closes settings", () => {
    mockMatchMedia(false);
    const onBack = vi.fn();
    render(
      <SettingsScreen
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

    // Esc in detail returns to list (the list has its own "‹ Back", which leaves Settings)
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: t("settings.tab_theme"),
      }),
    ).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      t("settings.title"),
    );
    expect(onBack).not.toHaveBeenCalled();

    // Esc in list closes settings
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders two-pane desktop layout from md (768px) up", () => {
    mockMatchMedia(true);
    render(
      <SettingsScreen
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

describe("Settings: every way back has the underline swipe", () => {
  const props = {
    name: "Alex River",
    email: "alex@example.com",
    settings: defaultSettings,
    onChange: vi.fn(),
    onBack: vi.fn(),
    onSignOut: vi.fn(),
  };
  const swipes = (button: HTMLElement) =>
    button.querySelector(".link-swipe") !== null;
  const media = (desktop: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: desktop && /min-width:\s*768px/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  };

  it("on a phone: '‹ Back' on the list and '‹ Settings' on a tab's page", () => {
    media(false);
    render(<SettingsScreen {...props} />);
    expect(swipes(screen.getByRole("button", { name: t("common.back") }))).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: t("app.tab_general") }));
    const back = screen.getByRole("button", { name: t("common.back") });
    expect(back.textContent).toContain(t("settings.title"));
    expect(swipes(back)).toBe(true);
    // The same look as every other Back: the theme colour
    expect(back.className).toContain("text-primary");
  });

  it("on desktop: '‹ Back' from Change password", () => {
    media(true);
    render(<SettingsScreen {...props} initialTab="account" />);
    fireEvent.click(
      screen.getByRole("button", { name: t("settings.change_password") }),
    );
    expect(swipes(screen.getByRole("button", { name: t("common.back") }))).toBe(
      true,
    );
  });
});

describe("Install app on a phone sits on the Settings page, above Sign out", () => {
  it("lists it before Sign out, and General no longer has it", () => {
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
    const onInstall = vi.fn();
    render(
      <SettingsScreen
        name="Alex River"
        email="alex@example.com"
        settings={defaultSettings}
        onChange={vi.fn()}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
        onInstall={onInstall}
      />,
    );
    const install = screen.getByRole("button", { name: t("app.install_app") });
    const signOut = screen.getByRole("button", { name: t("app.sign_out") });
    expect(
      install.compareDocumentPosition(signOut) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // An action, not a page: no chevron
    expect(install.querySelectorAll("svg")).toHaveLength(1);
    fireEvent.click(install);
    expect(onInstall).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t("app.tab_general") }));
    expect(
      screen.queryByRole("button", { name: t("app.install_app") }),
    ).toBeNull();
  });
});
