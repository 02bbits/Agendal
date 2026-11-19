import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu, InstallBanner } from "@/ui";
import { useInstall } from "@/app/useInstall";
import { wipeDevice } from "@/lib/device";
import { expectAxeCleanInBothThemes } from "./axe";

// AP-1: Install banner once per device (T-AP-01, T-AP-02, T-AP-101) and Account's Install app (T-AP-03)
function Banner() {
  const installer = useInstall(() => {});
  return installer.banner ? (
    <InstallBanner
      kind={installer.banner}
      onInstall={installer.install}
      onNotNow={installer.notNow}
    />
  ) : null;
}

/** Desktop: Install app sits in the account menu above Sign out (a phone has it on Settings). */
function Account({ toast = () => {} }: { toast?: (message: string) => void }) {
  const installer = useInstall(toast);
  return (
    <AccountMenu
      accountName="example"
      email="example@gmail.com"
      theme="system"
      onThemeChange={() => {}}
      onOpenSettings={() => {}}
      onSignOut={() => {}}
      onClose={() => {}}
      onInstall={installer.kind ? installer.install : undefined}
    />
  );
}

/** Chromium offers to install: the page keeps the event to prompt later. */
function offerPrompt(outcome: "accepted" | "dismissed") {
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const userAgent = (ua: string) =>
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

afterEach(() => {
  // Drops a kept prompt event, then forgets this test's Not now
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Install banner", () => {
  it("T-AP-01: Chromium shows Install and Not now; Install opens the browser prompt", async () => {
    render(<Banner />);
    expect(screen.queryByRole("status")).toBeNull();

    const event = offerPrompt("accepted");
    expect(screen.getByRole("status").textContent).toContain("Install Agendal");
    await expectAxeCleanInBothThemes();
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(event.prompt).toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a dismissed prompt doesn't count as Not now: the banner comes back next time", async () => {
    const { unmount } = render(<Banner />);
    offerPrompt("dismissed");
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(screen.queryByRole("status")).toBeNull();
    unmount();

    render(<Banner />);
    offerPrompt("dismissed");
    expect(screen.getByRole("button", { name: "Install" })).toBeTruthy();
  });

  it("T-AP-101: iOS gets Share → Add to Home Screen guidance, with no Install button", async () => {
    userAgent(IPHONE);
    render(<Banner />);
    expect(screen.getByRole("status").textContent).toContain(
      "Tap Share, then Add to Home Screen.",
    );
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
    await expectAxeCleanInBothThemes();
  });

  it("T-AP-02: Not now hides it for good on this device, sign-out included", async () => {
    userAgent(IPHONE);
    const { unmount } = render(<Banner />);
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("status")).toBeNull();
    unmount();

    vi.stubGlobal("indexedDB", { databases: async () => [] });
    await wipeDevice();
    render(<Banner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("isn't shown when already installed, or where install isn't possible", () => {
    render(<Banner />);
    expect(screen.queryByRole("status")).toBeNull(); // Firefox desktop: no prompt, no guidance

    userAgent(IPHONE);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    render(<Banner />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Account Install app", () => {
  it("T-AP-03: opens the browser prompt on Chromium, even after Not now", async () => {
    localStorage.setItem("agendal.install", "1");
    render(<Account />);
    expect(screen.queryByRole("menuitem", { name: /Install app/ })).toBeNull();

    const event = offerPrompt("dismissed");
    // Right above Sign out, with the same neutral icon as Account and Settings
    const items = screen
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(items.slice(-2)).toEqual(["Install app", "Sign out"]);
    const icon = screen
      .getByRole("menuitem", { name: /Install app/ })
      .querySelector("span");
    expect(icon?.className).toContain("text-ink-secondary");
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Install app/ }),
    );
    expect(event.prompt).toHaveBeenCalled();
  });

  it("T-AP-03: shows the iOS guidance where there is no prompt", async () => {
    userAgent(IPHONE);
    const toast = vi.fn();
    render(<Account toast={toast} />);
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Install app/ }),
    );
    expect(toast).toHaveBeenCalledWith("Tap Share, then Add to Home Screen.");
  });
});
