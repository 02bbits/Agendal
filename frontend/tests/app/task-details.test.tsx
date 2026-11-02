import { Suspense } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import TaskDetailsPage from "../../src/app/tasks/[id]/page";
import { t } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "../ui/axe";
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
    expect(screen.getByRole("button", { name: t("task.due") })).toBeTruthy();
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

  it("never shows or saves a wrong project when projects fail to load, and reloads projects on retry", async () => {
    let failProjects = true;
    const fakeTask = task({
      id: "t-1",
      title: "Project Task",
      project_id: "p-1",
    });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-1") return json(200, fakeTask);
      if (url === "/api/v1/projects") {
        if (failProjects)
          return json(404, { error: { code: "error.not_found" } });
        return json(200, [{ id: "p-1", name: "Alpha Project" }]);
      }
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

    // The project select is disabled
    const select = (await screen.findByLabelText(
      t("task.project"),
    )) as HTMLSelectElement;
    expect(select.disabled).toBe(true);

    // Does NOT show "No project"
    expect(screen.queryByText(t("project.none"))).toBeNull();

    // Shows "Couldn't load your projects." and Retry
    expect(
      screen.getAllByText(t("project.load_failed")).length,
    ).toBeGreaterThan(0);
    const retryBtn = screen.getByRole("button", { name: t("common.retry") });
    expect(retryBtn).toBeTruthy();

    // Retry with /projects now answering the list
    failProjects = false;
    await userEvent.click(retryBtn);

    // The select shows the project's name and is enabled
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(screen.getAllByText("Alpha Project").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(select.textContent).toContain("Alpha Project");

    // No PATCH was sent
    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("no project + projects 404 → disabled select shows No project, helper and Retry, no PATCH", async () => {
    const fakeTask = task({
      id: "t-1",
      title: "No Project Task",
      project_id: null,
    });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-1") return json(200, fakeTask);
      if (url === "/api/v1/projects")
        return json(404, { error: { code: "error.not_found" } });
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

    // The project select is disabled
    const select = (await screen.findByLabelText(
      t("task.project"),
    )) as HTMLSelectElement;
    expect(select.disabled).toBe(true);

    // Shows "No project"
    expect(screen.getByText(t("project.none"))).toBeTruthy();
    expect(select.value).toBe("");

    // Shows helper and Retry
    expect(screen.getByText(t("project.load_failed"))).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: t("common.retry") });
    expect(retryBtn).toBeTruthy();

    // No PATCH was sent
    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("mobile screen shows the back label and settings rows", async () => {
    const fakeTask = task({
      id: "t-mobile",
      title: "Mobile Screen Task",
      project_id: "p-hci",
      due_date: "2026-10-31",
      priority: "medium",
    });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-mobile") return json(200, fakeTask);
      if (url === "/api/v1/projects")
        return json(200, [
          {
            id: "p-hci",
            name: "HCI",
            colour: "orange",
            created_at: "2026-09-01T08:00:00Z",
          },
        ]);
      return json(404, {});
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-mobile" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(await screen.findByDisplayValue("Mobile Screen Task")).toBeTruthy();

    // Back button with label
    const backBtn = screen.getByRole("button", {
      name: new RegExp(t("common.back")),
    });
    expect(backBtn).toBeTruthy();

    // Settings rows
    expect(screen.getByLabelText(t("task.project"))).toBeTruthy();
    expect(screen.getByLabelText(t("task.due"))).toBeTruthy();
    expect(screen.getByLabelText(t("task.reminder"))).toBeTruthy();
    expect(screen.getByLabelText(t("task.repeat"))).toBeTruthy();

    // Delete task button at the bottom
    expect(screen.getByText(t("task.delete"))).toBeTruthy();
  });

  it("mobile screen is axe clean in both themes", async () => {
    const fakeTask = task({
      id: "t-axe-mobile",
      title: "Mobile Axe Task",
      project_id: "p-hci",
      due_date: "2026-10-31",
      priority: "high",
    });

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/tasks/t-axe-mobile") return json(200, fakeTask);
      if (url === "/api/v1/projects")
        return json(200, [
          {
            id: "p-hci",
            name: "HCI",
            colour: "orange",
            created_at: "2026-09-01T08:00:00Z",
          },
        ]);
      return json(404, {});
    });

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <AppFrame>
          <Suspense>
            <TaskDetailsPage params={Promise.resolve({ id: "t-axe-mobile" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    await screen.findByDisplayValue("Mobile Axe Task");
    await expectAxeCleanInBothThemes(view!.container);
  });
});
