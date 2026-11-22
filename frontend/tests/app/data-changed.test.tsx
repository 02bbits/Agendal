import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyTaskCreated } from "../../src/ui/domain/appEvents";
import { notesChanged } from "../../src/lib/noteApi";
import { SYNCED } from "../../src/lib/sync";
import { SETTLE_MS, useDataChanged } from "../../src/app/useDataChanged";
import { useSidebarData } from "../../src/app/frame/useSidebarData";

// AP §10 request budget: one reload per burst of changes, and the sidebar in one call

const visible = () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("useDataChanged", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T08:00:00+07:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("a save, a note change and the sync after them reload every screen once", () => {
    const inbox = vi.fn();
    const sidebar = vi.fn();
    renderHook(() => {
      useDataChanged(inbox);
      useDataChanged(sidebar);
    });

    notifyTaskCreated();
    notesChanged();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    window.dispatchEvent(new Event(SYNCED));
    vi.advanceTimersByTime(SETTLE_MS);

    expect(inbox).toHaveBeenCalledTimes(1);
    expect(sidebar).toHaveBeenCalledTimes(1);
  });

  it("coming back the same day reloads nothing; the sync says if anything changed", () => {
    const reload = vi.fn();
    renderHook(() => useDataChanged(reload));

    visible();
    vi.advanceTimersByTime(SETTLE_MS);

    expect(reload).not.toHaveBeenCalled();
  });

  it("coming back on another day reloads, so Today moves", () => {
    const reload = vi.fn();
    renderHook(() => useDataChanged(reload));

    vi.setSystemTime(new Date("2026-10-24T08:00:00+07:00"));
    visible();
    vi.advanceTimersByTime(SETTLE_MS);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const reload = vi.fn();
    const { unmount } = renderHook(() => useDataChanged(reload));

    unmount();
    notifyTaskCreated();
    vi.advanceTimersByTime(SETTLE_MS);

    expect(reload).not.toHaveBeenCalled();
  });
});

describe("useSidebarData", () => {
  const fetchMock = vi.fn(async (url: string) =>
    url === "/api/v1/counts"
      ? Response.json({ inbox: 2, upcoming: 3, no_project: 4, notes: 5 })
      : Response.json([]),
  );
  const asked = (path: string) =>
    fetchMock.mock.calls.filter(([url]) => url === `/api/v1${path}`).length;

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads every count in one call, and a screen change asks for nothing", async () => {
    const { result, rerender } = renderHook(
      ({ path }) => useSidebarData(path),
      { initialProps: { path: "/" } },
    );

    await waitFor(() =>
      expect(result.current.tabCounts).toMatchObject({
        inbox: 2,
        upcoming: 3,
        notes: 5,
      }),
    );
    expect(result.current.noProjectCount).toBe(4);
    expect(asked("/counts")).toBe(1);
    expect(asked("/projects")).toBe(1);

    await act(async () => rerender({ path: "/upcoming" }));
    await act(async () => rerender({ path: "/projects" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
