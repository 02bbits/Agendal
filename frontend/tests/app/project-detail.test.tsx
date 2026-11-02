import { Suspense } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import ProjectPage from "../../src/app/projects/[id]/page";
import { t } from "../../src/ui";
import { TASK_COLUMN_CLASS } from "../../src/ui/features/tasks/layout";
import { task } from "../ui/fixtures";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/projects/p-1";
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const mockProject = {
  project: {
    id: "p-1",
    name: "Test Project",
    colour: "blue",
    open: 2,
    done: 0,
    created_at: "2026-09-01T08:00:00Z",
  },
  progress: { done: 0, total: 2 },
  open: [
    task({
      id: "t-1",
      title: "First Task",
      project_id: "p-1",
      priority: "medium",
    }),
    task({
      id: "t-2",
      title: "Second Task",
      project_id: "p-1",
      priority: "low",
    }),
  ],
  completed: [],
  next_cursor: null,
};

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  pathname = "/projects/p-1";
  searchParams = new URLSearchParams();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=test-token";
  mockMatchMedia(true);
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

    expect(screen.queryByRole("status", { busy: true })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const skeleton = screen.getByRole("status", { busy: true });
    expect(skeleton).toBeTruthy();

    vi.useRealTimers();
  });

  it("drives task panel from URL as overlay: open, × then ‹ to /projects, stable column", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      return json(200, []);
    });

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const taskLink = await screen.findByRole("link", { name: /First Task/ });
    const contentColClasses = screen.getByRole("main").parentElement!.className;

    // Open from a row (wide): router.push(?task=t-1)
    await userEvent.click(taskLink);
    expect(router.push).toHaveBeenCalledWith("/projects/p-1?task=t-1");

    // Simulate URL update
    searchParams = new URLSearchParams("task=t-1");
    await act(async () => {
      view.rerender(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const panel = screen.getByRole("complementary", {
      name: t("task.heading"),
    });
    expect(panel).toBeTruthy();

    // The content column's classes don't change when the panel opens
    expect(screen.getByRole("main").parentElement!.className).toBe(
      contentColClasses,
    );

    // Close panel (×): this page pushed entry -> router.back()
    const closeBtn = within(panel).getByRole("button", {
      name: t("common.close"),
    });
    await userEvent.click(closeBtn);
    expect(router.back).toHaveBeenCalledOnce();

    // Simulate back navigation in URL
    searchParams = new URLSearchParams("");
    await act(async () => {
      view.rerender(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });
    expect(
      screen.queryByRole("complementary", { name: t("task.heading") }),
    ).toBeNull();

    // Then ‹ button in project header: goes to /projects in one press
    const backNavBtn = screen.getByRole("button", { name: t("common.back") });
    await userEvent.click(backNavBtn);
    expect(router.push).toHaveBeenCalledWith("/projects");
  });

  it("switching tasks while panel open uses router.replace", async () => {
    searchParams = new URLSearchParams("task=t-1");
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const task2Link = await screen.findByRole("link", { name: /Second Task/ });
    await userEvent.click(task2Link);

    expect(router.replace).toHaveBeenCalledWith("/projects/p-1?task=t-2");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("deep link ?task= + × -> replace(pathname)", async () => {
    searchParams = new URLSearchParams("task=t-1");
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const panel = await screen.findByRole("complementary", {
      name: t("task.heading"),
    });
    const closeBtn = within(panel).getByRole("button", {
      name: t("common.close"),
    });

    await userEvent.click(closeBtn);

    expect(router.replace).toHaveBeenCalledWith("/projects/p-1");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("leaving the page leaves nothing in the DOM outside it", async () => {
    searchParams = new URLSearchParams("task=t-1");
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      return json(200, []);
    });

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    await screen.findByRole("complementary", { name: t("task.heading") });

    act(() => {
      view.unmount();
    });

    expect(
      screen.queryByRole("complementary", { name: t("task.heading") }),
    ).toBeNull();
    expect(
      document.querySelector(`[aria-label="${t("task.heading")}"]`),
    ).toBeNull();
  });

  it("project detail rows wrapper has max-w-[820px] cap and AppShell column has lg:max-w-none", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    const moreBtn = await screen.findByRole("button", {
      name: t("project.menu"),
    });
    const contentCol = screen.getByRole("main").parentElement!;
    expect(contentCol.className).toContain("lg:max-w-none");
    expect(contentCol.contains(moreBtn)).toBe(true);

    const rowsWrapper = document.querySelector(".max-w-\\[820px\\]");
    expect(rowsWrapper).toBeTruthy();
    expect(rowsWrapper?.className).toContain(TASK_COLUMN_CLASS);
    expect(contentCol.contains(rowsWrapper)).toBe(true);
  });

  it("No project screen /projects/none lists open and completed tasks with no menu", async () => {
    pathname = "/projects/none";
    const noneProjectData = {
      project: null,
      progress: { done: 1, total: 2 },
      open: [
        task({
          id: "t-none-1",
          title: "Unassigned Open Task",
          project_id: null,
          priority: "high",
        }),
      ],
      completed: [
        task({
          id: "t-none-2",
          title: "Unassigned Done Task",
          project_id: null,
          done: true,
          done_at: "2026-10-23T10:00:00Z",
        }),
      ],
      next_cursor: null,
    };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/none") return json(200, noneProjectData);
      if (url === "/api/v1/projects")
        return json(200, [
          { id: "p-1", name: "Work", colour: "blue", open: 1, done: 0 },
        ]);
      if (url === "/api/v1/tasks/inbox") return json(200, {});
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "none" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    // Heading shows "No project" with grey dot
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("No project");
    const dot = heading.querySelector("span");
    expect(dot?.getAttribute("style")).toContain("var(--color-project-gray)");

    // Lists open and completed tasks
    expect(screen.getByText("Unassigned Open Task")).toBeTruthy();
    expect(screen.getByText("Unassigned Done Task")).toBeTruthy();

    // No menu (no rename, no delete)
    expect(
      screen.queryByRole("button", { name: t("project.menu") }),
    ).toBeNull();

    // Sidebar link points to /projects/none and shows count
    const sidebarNoProjectLink = document.querySelector(
      'a[href="/projects/none"]',
    );
    expect(sidebarNoProjectLink).not.toBeNull();
    expect(sidebarNoProjectLink?.textContent).toContain("No project");
    expect(sidebarNoProjectLink?.textContent).toContain("1");
  });

  it("task panel lists every project and moving a task takes it off this project", async () => {
    searchParams = new URLSearchParams("task=t-1");
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      if (url === "/api/v1/projects")
        return json(200, [
          { id: "p-1", name: "Test Project", colour: "blue", open: 2, done: 0 },
          { id: "p-2", name: "Personal", colour: "purple", open: 0, done: 0 },
        ]);
      if (url === "/api/v1/tasks/t-1" && init?.method === "PATCH")
        return json(
          200,
          task({ id: "t-1", title: "First Task", project_id: "p-2" }),
        );
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    await screen.findByRole("link", { name: /First Task/ });
    const panel = screen.getByRole("complementary", {
      name: t("task.heading"),
    });
    await userEvent.click(
      within(panel).getByRole("button", { name: t("task.project") }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Personal" }),
    );

    const patch = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/v1/tasks/t-1" && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      project_id: "p-2",
    });
    expect(screen.queryByRole("link", { name: /First Task/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Second Task/ })).toBeTruthy();
  });

  it("a task completed on a project screen keeps its row with the tick while it settles", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1") return json(200, mockProject);
      if (url === "/api/v1/tasks/t-1/complete")
        return json(200, {
          task: task({
            id: "t-1",
            title: "First Task",
            project_id: "p-1",
            done: true,
          }),
          next: null,
        });
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    await screen.findByRole("link", { name: /First Task/ });
    expect(screen.queryByRole("heading", { name: /Completed/ })).toBeNull();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: t("task.complete", { title: "First Task" }),
      }),
    );

    // Still in Open, ticked (now offers Reopen), with no Completed section yet
    expect(
      screen
        .getByRole("checkbox", {
          name: t("task.reopen", { title: "First Task" }),
        })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.queryByRole("heading", { name: /Completed/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: /First Task/ })).toHaveLength(1);

    // The "Completed …" toast with Undo shows, like the Inbox
    expect(
      await screen.findByText(t("task.completed", { title: "First Task" })),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: t("common.undo") })).toBeTruthy();

    // The tick is locked while it settles: another click sends nothing
    const tick = screen.getByRole("checkbox", {
      name: t("task.reopen", { title: "First Task" }),
    });
    expect(tick.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(tick);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/reopen")),
    ).toBe(false);
  });
});
