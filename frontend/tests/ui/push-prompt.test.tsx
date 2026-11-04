import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as pushLib from "@/lib/push";
import { t } from "@/ui";
import { SettingsRows } from "@/ui/features/tasks/details/SettingsRows";
import type { Clock } from "@/ui/features/tasks/types";
import { NOT_NOW_KEY } from "@/ui/features/tasks/usePushPrompt";
import { task } from "./fixtures";

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("Push prompt & explainer (Part F)", () => {
  let currentTime = new Date("2026-10-26T10:00:00Z");
  const clock: Clock = {
    now: () => currentTime,
    timeZone: "UTC",
  };

  beforeEach(() => {
    currentTime = new Date("2026-10-26T10:00:00Z");
    localStorage.clear();

    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      configurable: true,
    });

    mockMatchMedia(false);

    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });

    vi.stubGlobal("PushManager", {});
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn().mockResolvedValue({
              toJSON: () => ({
                endpoint: "https://push.example.com/sub/1",
                keys: { p256dh: "k", auth: "a" },
              }),
            }),
          },
        }),
        ready: Promise.resolve({}),
        getRegistration: vi.fn().mockResolvedValue(null),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const makeTask = (reminder: "none" | "15m" | "30m" | "1h" = "none") =>
    task({
      title: "Task with date",
      start_date: "2026-10-26",
      start_time: "14:00",
      reminder,
    });

  it("no prompt on mount", () => {
    render(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-10-26"
        clock={clock}
        onSave={() => {}}
      />,
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("ask on first reminder and Allow asks the browser", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const requestPermissionMock = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: requestPermissionMock,
    });
    const ensureSubscribedSpy = vi
      .spyOn(pushLib, "ensureSubscribed")
      .mockResolvedValue();

    render(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-10-26"
        clock={clock}
        onSave={onSave}
      />,
    );

    // Pick 15 minutes
    const reminderButton = screen.getByRole("button", {
      name: t("task.reminder"),
    });
    await user.click(reminderButton);

    const option = screen.getByRole("option", { name: t("reminder.15m") });
    await user.click(option);

    expect(onSave).toHaveBeenCalledWith({ reminder: "15m" });

    // Dialog should open
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText(t("task.push_explainer"))).toBeTruthy();

    const allowBtn = screen.getByRole("button", { name: t("common.allow") });
    const notNowBtn = screen.getByRole("button", { name: t("common.not_now") });
    expect(document.activeElement).toBe(notNowBtn);

    // Click Allow
    await user.click(allowBtn);

    expect(requestPermissionMock).toHaveBeenCalled();
    expect(ensureSubscribedSpy).toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Not now stays silent for 14 days and asks on day 15", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-10-26"
        clock={clock}
        onSave={() => {}}
      />,
    );

    // Pick 15m
    await user.click(screen.getByRole("button", { name: t("task.reminder") }));
    await user.click(screen.getByRole("option", { name: t("reminder.15m") }));

    expect(screen.getByRole("alertdialog")).toBeTruthy();

    // Click Not now
    await user.click(screen.getByRole("button", { name: t("common.not_now") }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // Verify localStorage has 14-day date
    const stored = localStorage.getItem(NOT_NOW_KEY);
    expect(stored).not.toBeNull();
    const storedDate = new Date(stored!);
    expect(storedDate.getTime()).toBeGreaterThan(currentTime.getTime());

    // Day 10: advance clock by 10 days
    currentTime = new Date(currentTime.getTime() + 10 * 24 * 60 * 60 * 1000);

    rerender(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-11-05"
        clock={clock}
        onSave={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: t("task.reminder") }));
    await user.click(screen.getByRole("option", { name: t("reminder.30m") }));

    // Dialog stays silent
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // Day 15: advance clock to day 15
    currentTime = new Date(currentTime.getTime() + 5 * 24 * 60 * 60 * 1000);

    rerender(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-11-10"
        clock={clock}
        onSave={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: t("task.reminder") }));
    await user.click(screen.getByRole("option", { name: t("reminder.1h") }));

    // Asks on day 15
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("denied shows helper", async () => {
    vi.stubGlobal("Notification", { permission: "denied" });

    render(
      <SettingsRows
        task={makeTask("15m")}
        projects={[]}
        todayDate="2026-10-26"
        clock={clock}
        onSave={() => {}}
      />,
    );

    expect(await screen.findByText(t("task.push_denied"))).toBeTruthy();
  });

  it("iPhone Safari shows install without Allow button", async () => {
    const user = userEvent.setup();

    // Stub iOS userAgent & non-standalone
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      configurable: true,
    });
    mockMatchMedia(false);

    render(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-10-26"
        clock={clock}
        onSave={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: t("task.reminder") }));
    await user.click(screen.getByRole("option", { name: t("reminder.15m") }));

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(t("app.install_for_reminders"))).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: t("common.allow") }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: t("common.not_now") }),
    ).toBeTruthy();
  });

  it("granted subscribes without a dialog", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("Notification", { permission: "granted" });
    const ensureSubscribedSpy = vi
      .spyOn(pushLib, "ensureSubscribed")
      .mockResolvedValue();

    render(
      <SettingsRows
        task={makeTask("none")}
        projects={[]}
        todayDate="2026-10-26"
        clock={clock}
        onSave={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: t("task.reminder") }));
    await user.click(screen.getByRole("option", { name: t("reminder.15m") }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(ensureSubscribedSpy).toHaveBeenCalled();
  });
});
