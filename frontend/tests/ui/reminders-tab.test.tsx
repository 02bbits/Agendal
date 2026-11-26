import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as push from "../../src/lib/push";
import { RemindersTab } from "../../src/ui/features/settings/reminders/RemindersTab";
import { expectAxeCleanInBothThemes } from "./axe";

// #186: Settings > Reminders turns this device's reminders on or off and sends a test push

function setup({
  state = "granted" as push.PushState,
  ready = true,
  subscribed = false,
} = {}) {
  vi.spyOn(push, "pushState").mockReturnValue(state);
  vi.spyOn(push, "pushReady").mockResolvedValue(ready);
  const isSubscribed = vi
    .spyOn(push, "pushSubscribed")
    .mockResolvedValue(subscribed);
  render(
    <main>
      <RemindersTab />
    </main>,
  );
  return { isSubscribed };
}

const reminderSwitch = () =>
  screen.getByRole("switch", { name: /Reminders on this device/ });
const testButton = () =>
  screen.getByRole("button", { name: "Send a test notification" });

afterEach(() => vi.restoreAllMocks());

describe("Settings > Reminders", () => {
  it("turns reminders on: asks the browser when it hasn't been asked", async () => {
    const { isSubscribed } = setup({ state: "ask" });
    const ask = vi.spyOn(push, "askForPush").mockImplementation(async () => {
      isSubscribed.mockResolvedValue(true);
      return "granted";
    });
    await waitFor(() =>
      expect((reminderSwitch() as HTMLButtonElement).disabled).toBe(false),
    );
    expect(reminderSwitch().getAttribute("aria-checked")).toBe("false");
    expect((testButton() as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(reminderSwitch());

    expect(ask).toHaveBeenCalled();
    await waitFor(() =>
      expect(reminderSwitch().getAttribute("aria-checked")).toBe("true"),
    );
    expect((testButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("with permission already given, turning on just subscribes; off forgets this device", async () => {
    const { isSubscribed } = setup({ state: "granted" });
    const subscribe = vi
      .spyOn(push, "subscribePush")
      .mockImplementation(async () => {
        isSubscribed.mockResolvedValue(true);
        return true;
      });
    const off = vi.spyOn(push, "turnOffPush").mockImplementation(async () => {
      isSubscribed.mockResolvedValue(false);
    });
    await waitFor(() =>
      expect((reminderSwitch() as HTMLButtonElement).disabled).toBe(false),
    );

    await userEvent.click(reminderSwitch());
    expect(subscribe).toHaveBeenCalled();
    await waitFor(() =>
      expect(reminderSwitch().getAttribute("aria-checked")).toBe("true"),
    );

    await userEvent.click(reminderSwitch());
    expect(off).toHaveBeenCalled();
    await waitFor(() =>
      expect(reminderSwitch().getAttribute("aria-checked")).toBe("false"),
    );
  });

  it("sends a test and says how it went", async () => {
    setup({ subscribed: true });
    const send = vi
      .spyOn(push, "sendTestPush")
      .mockResolvedValueOnce({ sent: 1, gone: 0, failed: 0 })
      .mockResolvedValueOnce({ error: "too_many" });
    await waitFor(() =>
      expect((testButton() as HTMLButtonElement).disabled).toBe(false),
    );
    await expectAxeCleanInBothThemes(document.body);

    await userEvent.click(testButton());
    expect(send).toHaveBeenCalled();
    expect((await screen.findByRole("status")).textContent).toContain(
      "Sent. It should show in a few seconds.",
    );

    await userEvent.click(testButton());
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Wait a minute before sending another.",
      ),
    );
  });

  it("a test that finds the device gone turns the switch off", async () => {
    setup({ subscribed: true });
    vi.spyOn(push, "sendTestPush").mockResolvedValue({
      sent: 0,
      gone: 1,
      failed: 0,
    });
    await waitFor(() =>
      expect((testButton() as HTMLButtonElement).disabled).toBe(false),
    );

    await userEvent.click(testButton());

    expect((await screen.findByRole("status")).textContent).toContain(
      "This device was unsubscribed.",
    );
    expect(reminderSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it.each([
    {
      label: "server push not configured",
      ready: false,
      state: "granted" as push.PushState,
      text: "Push isn't set up on the server.",
    },
    {
      label: "permission blocked",
      ready: true,
      state: "denied" as push.PushState,
      text: "Blocked. Allow it in the browser's site settings.",
    },
    {
      label: "browser unsupported",
      ready: true,
      state: "unsupported" as push.PushState,
      text: "This browser can't show notifications.",
    },
    {
      label: "iOS requires install",
      ready: true,
      state: "install" as push.PushState,
      text: "Install Agendal to get reminders on this iPhone.",
    },
  ])(
    "says why the switch can't be used: $label",
    async ({ ready, state, text }) => {
      setup({ ready, state });
      await waitFor(() =>
        expect(
          reminderSwitch().closest("label, div")?.textContent ??
            document.body.textContent,
        ).toContain(text),
      );
      expect((reminderSwitch() as HTMLButtonElement).disabled).toBe(true);
      expect((testButton() as HTMLButtonElement).disabled).toBe(true);
    },
  );
});
