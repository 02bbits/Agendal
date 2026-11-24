import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addReminderAlert,
  clearReminderAlerts,
  dismissReminderAlert,
  getReminderAlertCount,
  getReminderAlerts,
} from "@/ui/features/reminders/reminderAlertStore";
import { ReminderReturnBanner } from "@/ui/features/reminders/ReminderReturnBanner";
import { formatDocumentTitle } from "@/app/frame/useScreenFocus";

describe("Reminder Badge & Return Banner (#186)", () => {
  beforeEach(() => {
    clearReminderAlerts();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearReminderAlerts();
    sessionStorage.clear();
  });

  it("adds and dismisses reminder alerts in the store", () => {
    expect(getReminderAlertCount()).toBe(0);

    const alert1 = addReminderAlert({
      id: "task-1",
      title: "Email the group about the ER diagram",
      url: "/tasks/task-1",
    });

    expect(getReminderAlertCount()).toBe(1);
    expect(getReminderAlerts()[0]?.title).toBe(
      "Email the group about the ER diagram",
    );

    // Duplicate ID updates rather than creating duplicate
    addReminderAlert({
      id: "task-1",
      title: "Email the group about the ER diagram (updated)",
      url: "/tasks/task-1",
    });
    expect(getReminderAlertCount()).toBe(1);
    expect(getReminderAlerts()[0]?.title).toBe(
      "Email the group about the ER diagram (updated)",
    );

    // Dismiss removes it
    dismissReminderAlert(alert1.id);
    expect(getReminderAlertCount()).toBe(0);
  });

  it("formats document title as '(1) Agendal' when an alert is active, and 'Agendal' otherwise", () => {
    expect(formatDocumentTitle()).toBe("Agendal");

    addReminderAlert({
      id: "rem-1",
      title: "Team meeting",
      url: "/tasks/rem-1",
    });

    // Specifically '(1) Agendal' as requested
    expect(formatDocumentTitle()).toBe("(1) Agendal");

    // Multiple alerts
    addReminderAlert({
      id: "rem-2",
      title: "Submit report",
      url: "/tasks/rem-2",
    });
    expect(formatDocumentTitle()).toBe("(2) Agendal");

    // Clearing reverts title back to 'Agendal'
    clearReminderAlerts();
    expect(formatDocumentTitle()).toBe("Agendal");
  });

  it("renders ReminderReturnBanner with motion animation classes, flat view alignment, and expandable card", async () => {
    const onView = vi.fn();
    const onDismiss = vi.fn();
    const onDismissAlert = vi.fn();
    const alert = {
      id: "t-1",
      title: "Submit assignment",
      url: "/tasks/t-1",
      timestamp: Date.now(),
    };

    const { rerender } = render(
      <ReminderReturnBanner
        alert={alert}
        alerts={[alert]}
        count={1}
        onView={onView}
        onDismissAlert={onDismissAlert}
        onDismiss={onDismiss}
      />,
    );

    const banner = screen.getByRole("alert");
    expect(banner.className).toContain("animate-reminder-drop");
    expect(banner.className).toContain("mx-auto");
    expect(banner.className).toContain("pointer-events-auto");
    expect(screen.getByText("Reminder")).toBeDefined();

    // Click View expands in-place section
    const viewBtn = screen.getByRole("button", { name: /View/i });
    fireEvent.click(viewBtn);

    // Click reminder item in expanded card calls onView
    const itemBtns = screen.getAllByText("Submit assignment");
    fireEvent.click(itemBtns[1] ?? itemBtns[0]!);
    expect(onView).toHaveBeenCalledWith(alert);

    // Click dismiss banner
    const dismissBtn = screen.getByRole("button", {
      name: "Dismiss reminder alert",
    });
    fireEvent.click(dismissBtn);
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());

    // Swipe to dismiss on mobile (#186)
    onDismiss.mockClear();
    fireEvent.touchStart(banner, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(banner, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(banner);
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());

    // With count > 1
    rerender(
      <ReminderReturnBanner
        alert={alert}
        alerts={[alert, { id: "t-2", title: "Task 2", timestamp: Date.now() }]}
        count={2}
        onView={onView}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("Reminders (2)")).toBeDefined();

    // Null alert renders nothing
    rerender(
      <ReminderReturnBanner
        alert={null}
        count={0}
        onView={onView}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();

    // Re-appearing with a new alert starts in collapsed state (not expanded)
    rerender(
      <ReminderReturnBanner
        alert={{ id: "t-3", title: "New Task Alert", timestamp: Date.now() }}
        count={1}
        onView={onView}
        onDismiss={onDismiss}
      />,
    );
    const viewButton = screen.getByRole("button", { name: /View/i });
    expect(viewButton.getAttribute("aria-expanded")).toBe("false");
  });
});
