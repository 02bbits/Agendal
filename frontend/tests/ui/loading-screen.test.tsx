import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOADING_MAX_MS,
  LOADING_MIN_MS,
  TabLoading,
  TabPending,
} from "../../src/app/TabLoading";
import { InboxSkeleton, ProjectSkeleton } from "../../src/app/skeletons";
import { AppShell } from "../../src/ui/features/shell/AppShell";
import { LoadingScreen } from "../../src/ui/components/LoadingScreen";
import { t } from "../../src/ui/copy";

const FADE = 150;

function Frame({
  tab,
  ready,
  onDone,
}: {
  tab: string | null;
  ready: boolean;
  onDone?: () => void;
}) {
  return (
    <TabLoading show={tab !== null} ready={ready} onDone={onDone}>
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

  it("comes back when asked again (signing in or out), until the screen it goes to is there", async () => {
    const onDone = vi.fn();
    const { rerender } = render(
      <Frame tab={null} ready={false} onDone={onDone} />,
    );
    expect(loading()).toBeNull();
    // Signed in on Sign in: going into the app
    rerender(<Frame tab="enter" ready={false} onDone={onDone} />);
    expect(loading()?.dataset.state).toBe("visible");
    await advance(LOADING_MIN_MS + 200);
    expect(loading()?.dataset.state).toBe("visible");
    // Inbox is there
    rerender(<Frame tab="enter" ready={true} onDone={onDone} />);
    await advance(10);
    expect(loading()?.dataset.state).toBe("hiding");
    await advance(FADE + 10);
    expect(loading()).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("comes back when signing in while the start screen fades out", async () => {
    const onDone = vi.fn();
    // On Sign in, the session checked: the start screen begins to fade
    const { rerender } = render(
      <Frame tab="start" ready={true} onDone={onDone} />,
    );
    await advance(LOADING_MIN_MS + 10);
    expect(loading()?.dataset.state).toBe("hiding");
    // Signed in mid-fade: going into the app, which isn't there yet
    rerender(<Frame tab="enter" ready={false} onDone={onDone} />);
    await advance(FADE + 10);
    expect(loading()?.dataset.state).toBe("visible");
    expect(onDone).not.toHaveBeenCalled();
    // Inbox is there
    rerender(<Frame tab="enter" ready={true} onDone={onDone} />);
    await advance(LOADING_MIN_MS);
    expect(loading()?.dataset.state).toBe("hiding");
    await advance(FADE + 10);
    expect(loading()).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("doesn't show when the app starts off the tabs (sign in)", async () => {
    render(<Frame tab={null} ready={false} />);
    await advance(10);
    expect(loading()).toBeNull();
  });
});

describe("TabPending: a tab opened for the first time (#161)", () => {
  afterEach(cleanup);

  it("on a phone's first visit: the tab's header, then the loading screen in the content", () => {
    render(
      <TabPending
        title="Upcoming"
        overline="WEDNESDAY, 18 NOVEMBER"
        accountInitial="H"
        navigate={() => true}
        body={<LoadingScreen inline />}
      />,
    );
    expect(screen.getByRole("heading", { name: "Upcoming" })).toBeTruthy();
    expect(screen.getByText("WEDNESDAY, 18 NOVEMBER")).toBeTruthy();
    expect(screen.getByRole("status", { name: t("app.loading") })).toBeTruthy();
    // In the content, not over the whole screen
    expect(screen.getByTestId("tab-loading").className).not.toContain("fixed");
    // A loader inside the app: the spinner only, no logo or app name
    expect(screen.getByTestId("tab-loading").textContent).not.toContain(
      t("app.name"),
    );
    expect(
      screen.getByTestId("tab-loading").querySelector(".loading-spinner"),
    ).toBeTruthy();
  });

  it("otherwise: the header and the screen's own skeleton, the same one the screen shows", () => {
    const { container } = render(
      <TabPending
        title="Inbox"
        accountInitial="H"
        navigate={() => true}
        body={<InboxSkeleton />}
      />,
    );
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByTestId("inbox-loading")).toBeTruthy();
    expect(container.querySelector('[data-testid="tab-loading"]')).toBeNull();
  });

  it("a project brings its own header inside its skeleton", () => {
    render(
      <TabPending
        accountInitial="H"
        navigate={() => true}
        body={<ProjectSkeleton />}
      />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
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
