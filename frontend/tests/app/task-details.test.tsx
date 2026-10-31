import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import TaskDetailsPage from "../../src/app/tasks/[id]/page";
import { t } from "../../src/ui";
import { task } from "../ui/fixtures";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/tasks/t-1";
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
  pathname = "/tasks/t-1";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Task details page /tasks/[id]", () => {
  it("loads and shows the task fields", async () => {
    const fakeTask = task({
      id: "t-1",
      title: "Buy groceries",
      due_date: "2026-10-31",
      priority: "high",
    });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-1") return json(200, fakeTask);
      if (url === "/api/v1/projects") return json(200, []);
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const titleInput = await screen.findByDisplayValue("Buy groceries");
    expect(titleInput).toBeTruthy();
    expect(screen.getByDisplayValue("2026-10-31")).toBeTruthy();
    expect(screen.getByLabelText(t("task.priority"))).toBeTruthy();
  });

  it("shows error.not_found with Back on 404 (TK-E13)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-missing") {
        return json(404, { error: { code: "error.not_found" } });
      }
      if (url === "/api/v1/projects") return json(200, []);
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-missing" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(await screen.findByText(t("error.not_found"))).toBeTruthy();

    const backButton = screen.getByRole("button", {
      name: t("common.back"),
    });
    await userEvent.click(backButton);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("shows error.generic with (Ref req-123) and Retry on 500 and re-fetches when clicked", async () => {
    let fail = true;
    const fakeTask = task({ id: "t-1", title: "Flaky Task" });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-1") {
        if (fail)
          return json(500, {
            error: { code: "error.generic", request_id: "req-123" },
          });
        return json(200, fakeTask);
      }
      if (url === "/api/v1/projects") return json(200, []);
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(
      await screen.findByText(t("error.generic", { request_id: "req-123" })),
    ).toBeTruthy();
    expect(screen.getByText(/\(Ref req-123\)/)).toBeTruthy();

    fail = false;
    const retryBtn = screen.getByRole("button", {
      name: t("common.retry"),
    });
    await userEvent.click(retryBtn);

    expect(await screen.findByDisplayValue("Flaky Task")).toBeTruthy();
  });

  it("shows app.offline and Retry when fetch rejects with TypeError", async () => {
    let fail = true;
    const fakeTask = task({ id: "t-1", title: "Offline Task" });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-1") {
        if (fail) throw new TypeError("Failed to fetch");
        return json(200, fakeTask);
      }
      if (url === "/api/v1/projects") return json(200, []);
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(await screen.findByText(t("app.offline"))).toBeTruthy();

    fail = false;
    const retryBtn = screen.getByRole("button", {
      name: t("common.retry"),
    });
    await userEvent.click(retryBtn);

    expect(await screen.findByDisplayValue("Offline Task")).toBeTruthy();
  });

  it("sends PATCH when a field changes", async () => {
    const fakeTask = task({
      id: "t-1",
      title: "Original Title",
      due_date: "2026-10-31",
    });

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-1" && init?.method === "PATCH") {
        const body = JSON.parse(init.body as string);
        return json(200, { ...fakeTask, ...body });
      }
      if (url === "/api/v1/tasks/t-1") return json(200, fakeTask);
      if (url === "/api/v1/projects") return json(200, []);
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const input = await screen.findByDisplayValue("Original Title");
    fireEvent.change(input, { target: { value: "Updated Title" } });
    fireEvent.blur(input);

    await screen.findByDisplayValue("Updated Title");

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/v1/tasks/t-1" && init?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body as string);
    expect(body.title).toBe("Updated Title");
    expect(body.at).toBeDefined();
  });

  it("shows skeleton after 300 ms when loading", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-slow") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return json(200, task({ id: "t-slow", title: "Slow Task" }));
      }
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-slow" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    // Before 300ms, no skeleton
    expect(screen.queryByRole("status", { busy: true })).toBeNull();

    // Fast-forward 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const skeleton = screen.getByRole("status", { busy: true });
    expect(skeleton).toBeTruthy();
    expect(skeleton.getAttribute("aria-busy")).toBe("true");

    vi.useRealTimers();
  });
});
