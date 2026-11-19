import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../../src/ui";

const defaultSettings = {
  theme: "system" as const,
  weekStart: "mon" as const,
  timeFormat: "24h" as const,
  rememberDevice: true,
  pageView: "flat" as const,
  palette: "default",
  timezone: "Asia/Ho_Chi_Minh",
  timezoneAuto: true,
};

describe("SettingsScreen Settings Tabs & Timezone Optimization", () => {
  it("renders only the 4 core settings tabs on desktop", () => {
    // Desktop layout
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("768px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

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

    // Core 4 tabs (navigation has role="radio")
    expect(screen.getByRole("radio", { name: /Account/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /General/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Theme/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Sidebar/i })).toBeTruthy();

    // Removed tabs must not exist
    expect(screen.queryByRole("radio", { name: /Reminders/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Notifications/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Quick add/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Productivity/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Backups/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Integrations/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Calendars/i })).toBeNull();
  });

  it("timezone dropdown lists popular timezones without a search box or coming-soon zones", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("768px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onChange = vi.fn();

    render(
      <SettingsScreen
        name="Alex River"
        email="alex@example.com"
        initialTab="general"
        settings={defaultSettings}
        onChange={onChange}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    // Find the Time zone dropdown trigger
    const tzTrigger = screen.getByRole("button", {
      name: /Automatic/i,
    });
    expect(tzTrigger).toBeTruthy();
    fireEvent.click(tzTrigger);

    // Listbox opens without a search box, and no zone is a disabled "coming soon" one
    const listbox = screen.getByRole("listbox", { name: /Time zone/i });
    expect(listbox).toBeTruthy();
    expect(
      screen.queryByRole("textbox", { name: /Search Time zone/i }),
    ).toBeNull();
    expect(listbox.querySelectorAll('[aria-disabled="true"]').length).toBe(0);

    // Verify popular timezone is enabled and clickable (e.g. Tokyo)
    const tokyoOption = screen.getByRole("option", { name: /Tokyo/i });
    expect(tokyoOption.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(tokyoOption);

    expect(onChange).toHaveBeenCalledWith({
      timezone: "Asia/Tokyo",
      timezoneAuto: false,
    });
  });

  it("selecting automatic timezone updates timezoneAuto to true", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("768px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onChange = vi.fn();

    render(
      <SettingsScreen
        name="Alex River"
        email="alex@example.com"
        initialTab="general"
        settings={{
          ...defaultSettings,
          timezone: "Asia/Tokyo",
          timezoneAuto: false,
        }}
        onChange={onChange}
        onBack={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    const tzTrigger = screen.getByRole("button", {
      name: /Tokyo/i,
    });
    fireEvent.click(tzTrigger);

    const autoOption = screen.getByRole("option", { name: /Automatic/i });
    fireEvent.click(autoOption);

    expect(onChange).toHaveBeenCalledWith({
      timezoneAuto: true,
    });
  });
});
