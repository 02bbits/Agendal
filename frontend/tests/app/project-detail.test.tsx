import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import ProjectPage from "../../src/app/projects/[id]/page";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/projects/p-1";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  pathname = "/projects/p-1";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Project detail page /projects/[id]", () => {
  it("shows smooth skeleton after 300 ms when loading (UX-03)", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-slow") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return json(200, {
          project: {
            id: "p-slow",
            name: "Slow Project",
            colour: "red",
            open: 0,
            done: 0,
          },
          progress: { done: 0, total: 0 },
          open: [],
          completed: [],
          next_cursor: null,
        });
      }
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-slow" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    // Before 300ms, nothing is shown
    expect(screen.queryByRole("status", { busy: true })).toBeNull();

    // Fast forward 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Skeleton is now visible
    const skeleton = screen.getByRole("status", { busy: true });
    expect(skeleton).toBeTruthy();

    vi.useRealTimers();
  });
});
