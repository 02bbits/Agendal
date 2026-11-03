import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import UpcomingPage from "../../src/app/upcoming/page";
import { setTimeZone } from "../../src/lib/clock";
import { t } from "../../src/ui";
import { task } from "../ui/fixtures";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
const pathname = "/upcoming";
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Upcoming page /upcoming (Refs #28)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
    setTimeZone("Asia/Ho_Chi_Minh");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows error.generic with (Ref <id>) on 500, never {request_id}", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects") return json(200, []);
      if (url === "/api/v1/projects/none")
        return json(200, { progress: { done: 0, total: 0 } });
      if (url === "/api/v1/tasks?view=inbox")
        return json(200, { overdue: [], today: [] });
      if (url.includes("view=upcoming")) {
        return json(500, {
          error: { code: "error.generic", request_id: "req-999" },
        });
      }
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <UpcomingPage />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(
      await screen.findByText(t("error.generic", { request_id: "req-999" })),
    ).toBeTruthy();
    expect(screen.getByText(/\(Ref req-999\)/)).toBeTruthy();
    expect(screen.queryByText(/\{request_id\}/)).toBeNull();
  });

  it("shows fresh rows after agendal:task-created event", async () => {
    const task1 = task({
      id: "t-1",
      title: "First Task",
      due_date: "2026-10-24",
    });
    const task2 = task({
      id: "t-2",
      title: "Newly Created Task",
      due_date: "2026-10-25",
    });

    let currentTasks = [task1];

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects") return json(200, []);
      if (url === "/api/v1/projects/none")
        return json(200, { progress: { done: 0, total: 0 } });
      if (url === "/api/v1/tasks?view=inbox")
        return json(200, { overdue: [], today: [] });
      if (url.includes("view=upcoming")) {
        return json(200, {
          days: [
            {
              date: "2026-10-24",
              tasks: currentTasks.filter((t) => t.due_date === "2026-10-24"),
            },
            {
              date: "2026-10-25",
              tasks: currentTasks.filter((t) => t.due_date === "2026-10-25"),
            },
          ],
          next_from: null,
        });
      }
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <UpcomingPage />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(await screen.findByText("First Task")).toBeTruthy();
    expect(screen.queryByText("Newly Created Task")).toBeNull();

    currentTasks = [task1, task2];

    await act(async () => {
      window.dispatchEvent(new Event("agendal:task-created"));
    });

    expect(await screen.findByText("Newly Created Task")).toBeTruthy();
  });

  it("calls upcoming with no from= and inbox for overdue tasks", async () => {
    const overdueTask = task({
      id: "t-overdue",
      title: "Overdue from Inbox",
      due_date: "2026-10-20",
    });
    const upcomingTask = task({
      id: "t-upcoming",
      title: "Tomorrow from Upcoming",
      due_date: "2026-10-24",
    });

    const requestedUrls: string[] = [];

    fetchMock.mockImplementation(async (url: string) => {
      requestedUrls.push(url);
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects") return json(200, []);
      if (url === "/api/v1/projects/none")
        return json(200, { progress: { done: 0, total: 0 } });
      if (url === "/api/v1/tasks?view=inbox")
        return json(200, {
          overdue: [overdueTask],
          today: [],
          no_date: [],
          completed_today: [],
        });
      if (url.includes("view=upcoming")) {
        return json(200, {
          days: [
            {
              date: "2026-10-24",
              tasks: [upcomingTask],
            },
          ],
          next_from: null,
        });
      }
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <UpcomingPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const upcomingUrl = requestedUrls.find((u) => u.includes("view=upcoming"));
    expect(upcomingUrl).toBeTruthy();
    expect(upcomingUrl).not.toContain("from=");
    expect(upcomingUrl).toContain("days=366");

    const inboxUrl = requestedUrls.find((u) => u.includes("view=inbox"));
    expect(inboxUrl).toBe("/api/v1/tasks?view=inbox");

    expect(await screen.findByText("Overdue from Inbox")).toBeTruthy();
    expect(await screen.findByText("Tomorrow from Upcoming")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Overdue 1/ })).toBeTruthy();
  });
});
