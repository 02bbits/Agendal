import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as push from "../../src/lib/push";
import { notifyReminderSet } from "../../src/ui/domain/appEvents";
import { PushPrompt } from "../../src/ui/features/tasks/PushPrompt";
import { expectAxeCleanInBothThemes } from "./axe";

// #186, TK §2.5: notifications are asked for in context, the first time a reminder is set

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("PushPrompt", () => {
  beforeEach(() => {
    vi.spyOn(push, "renewPush").mockResolvedValue();
  });

  it("asks nothing at sign-in; a device that already allowed it subscribes again quietly", () => {
    render(<PushPrompt signedIn />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(push.renewPush).toHaveBeenCalled();
  });

  it("the first reminder brings the explainer; Allow asks the browser", async () => {
    vi.spyOn(push, "pushState").mockReturnValue("ask");
    const ask = vi.spyOn(push, "askForPush").mockResolvedValue("granted");
    render(<PushPrompt signedIn />);

    act(() => notifyReminderSet());
    expect(
      await screen.findByRole("alertdialog", {
        name: "Get a notification before tasks with reminders?",
      }),
    ).toBeTruthy();
    await expectAxeCleanInBothThemes(document.body);

    await userEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(ask).toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Not now keeps it away for 14 days", async () => {
    vi.spyOn(push, "pushState").mockReturnValue("ask");
    const ask = vi.spyOn(push, "askForPush");
    render(<PushPrompt signedIn />);

    act(() => notifyReminderSet());
    await userEvent.click(
      await screen.findByRole("button", { name: "Not now" }),
    );
    expect(ask).not.toHaveBeenCalled();
    expect(push.pushSnoozed()).toBe(true);

    act(() => notifyReminderSet());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("on an iPhone in Safari it says to install the app, with no Allow", async () => {
    vi.spyOn(push, "pushState").mockReturnValue("install");
    render(<PushPrompt signedIn />);

    act(() => notifyReminderSet());
    expect(
      await screen.findByRole("alertdialog", {
        name: "Install Agendal to get reminders on this iPhone.",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
  });

  it("asks nothing once answered, or where push can't work", () => {
    const state = vi.spyOn(push, "pushState");
    render(<PushPrompt signedIn />);
    for (const answered of ["granted", "denied", "unsupported"] as const) {
      state.mockReturnValue(answered);
      act(() => notifyReminderSet());
      expect(screen.queryByRole("alertdialog")).toBeNull();
    }
  });
});
