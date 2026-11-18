import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOADING_MAX_MS,
  LOADING_MIN_MS,
  TabLoading,
  TabPending,
} from "../../src/app/TabLoading";
import { AppShell } from "../../src/ui/features/shell/AppShell";
import { LoadingScreen } from "../../src/ui/components/LoadingScreen";
import { t } from "../../src/ui/copy";

const FADE = 150;

function Frame({ tab, ready }: { tab: string | null; ready: boolean }) {
  return (
    <TabLoading tab={tab} ready={ready}>
      <p>Page</p>
    </TabLoading>
  );
}

const loading = () => screen.queryByTestId("loading-screen");
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("LoadingScreen (#161)", () => {
  afterEach(cleanup);

  it("is a status the screen reader calls Loading, with the logo and a spinner", () => {
    render(<LoadingScreen />);
    const status = screen.getByRole("status", { name: t("app.loading") });
    expect(status.textContent).toContain(t("app.name"));
    expect(status.querySelector(".loading-spinner")).toBeTruthy();
    // The theme's own background, so it follows light and dark
    expect(status.className).toContain("bg-paper");
  });
});

describe("TabLoading: full screen only as the app starts (#161)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("waits for the session check, at least the minimum, then fades out", async () => {
    const { rerender } = render(<Frame tab="inbox" ready={false} />);
    expect(loading()?.dataset.state).toBe("visible");
    await advance(LOADING_MIN_MS + 500);
    // Still checking the session
    expect(loading()?.dataset.state).toBe("visible");
    rerender(<Frame tab="inbox" ready={true} />);
    await advance(10);
    expect(loading()?.dataset.state).toBe("hiding");
    await advance(FADE + 10);
    expect(loading()).toBeNull();
  });

  it("stays the minimum even when the session check answers at once", async () => {
    render(<Frame tab="inbox" ready={true} />);
    await advance(LOADING_MIN_MS - 50);
    expect(loading()?.dataset.state).toBe("visible");
    await advance(100);
    expect(loading()?.dataset.state).toBe("hiding");
  });

  it("never stays longer than the maximum (offline or slow)", async () => {
    render(<Frame tab="projects" ready={false} />);
    await advance(LOADING_MAX_MS + 10);
    // The fade's own timer starts once the screen has begun hiding
    await advance(FADE + 10);
    expect(loading()).toBeNull();
  });

  it("doesn't come back on a tab switch: the tab shows its skeleton instead", async () => {
    const { rerender } = render(<Frame tab="inbox" ready={true} />);
    await advance(LOADING_MIN_MS + 10);
    await advance(FADE + 10);
    expect(loading()).toBeNull();
    rerender(<Frame tab="upcoming" ready={true} />);
    await advance(10);
    expect(loading()).toBeNull();
  });

  it("doesn't show when the app starts off the tabs (sign in)", async () => {
    render(<Frame tab={null} ready={false} />);
    await advance(10);
    expect(loading()).toBeNull();
  });
});

describe("TabPending: a tab opened for the first time (#161)", () => {
  afterEach(cleanup);

  it("on a phone: the tab's header, then the loading screen in the content", () => {
    render(
      <TabPending
        title="Upcoming"
        overline="WEDNESDAY, 18 NOVEMBER"
        accountInitial="H"
        navigate={() => true}
        wide={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Upcoming" })).toBeTruthy();
    expect(screen.getByText("WEDNESDAY, 18 NOVEMBER")).toBeTruthy();
    expect(screen.getByRole("status", { name: t("app.loading") })).toBeTruthy();
    expect(screen.queryByTestId("tab-skeleton")).toBeNull();
    // In the content, not over the whole screen
    expect(screen.getByTestId("tab-loading").className).not.toContain("fixed");
  });

  it("from 768px: the header, then a skeleton, no loading screen", () => {
    render(
      <TabPending
        title="Projects"
        accountInitial="H"
        navigate={() => true}
        wide={true}
      />,
    );
    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.getByTestId("tab-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("tab-loading")).toBeNull();
  });

  it("the shell keeps the current page mounted but hidden while a tab is pending", () => {
    const { rerender } = render(
      <AppShell tab="inbox" pending={<p>Pending</p>}>
        <p>Current page</p>
      </AppShell>,
    );
    expect(screen.getByText("Pending")).toBeTruthy();
    const page = screen.getByText("Current page");
    expect(page.parentElement?.className).toContain("hidden");
    rerender(
      <AppShell tab="upcoming">
        <p>Current page</p>
      </AppShell>,
    );
    expect(screen.queryByText("Pending")).toBeNull();
    expect(
      screen.getByText("Current page").parentElement?.className,
    ).not.toContain("hidden");
  });
});
