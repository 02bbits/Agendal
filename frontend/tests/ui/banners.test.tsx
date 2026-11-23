import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "@/lib/serviceWorker";
import { InstallBanner, OfflineBanner } from "@/ui/features";
import { t } from "@/ui/copy";
import { expectAxeCleanInBothThemes } from "./axe";

// IM-55: the shell banners (AP §6, A11Y-70) and the offline wording without a service worker (AP-E11)
afterEach(() => vi.unstubAllEnvs());

describe("shell banners", () => {
  it("A11Y-70: offline and install banners are status regions that leave focus alone", async () => {
    const button = document.createElement("button");
    button.textContent = "Write a note";
    document.body.append(button);
    button.focus();
    render(
      <>
        <OfflineBanner />
        <InstallBanner kind="ios" onInstall={() => {}} onNotNow={() => {}} />
      </>,
    );

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(document.activeElement).toBe(button);
    await expectAxeCleanInBothThemes();
    button.remove();
  });

  it("AP-E11, T-AP-108: when the service worker can't install, the offline banner says offline isn't available", async () => {
    const { unmount } = render(<OfflineBanner />);
    expect(screen.getByRole("status").textContent).toContain(
      t("app.offline_body"),
    );
    unmount();

    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        register: vi.fn(async () => {
          throw new DOMException("blocked", "SecurityError");
        }),
      },
    });
    registerServiceWorker(() => {});
    await new Promise((resolve) => setTimeout(resolve));

    render(<OfflineBanner />);
    expect(screen.getByRole("status").textContent).toContain(
      t("app.no_offline"),
    );
  });
});
