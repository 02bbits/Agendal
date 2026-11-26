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
  window.localStorage.setItem("agendal.page_view", "full");
  mockMatchMedia(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Project detail page /projects/[id]", () => {
  it("shows its skeleton at once while loading, the same one the tap showed (UX-03, #161)", async () => {
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

    // No blank gap before it: the screen goes straight from the tap's skeleton to its own
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
    expect(router.push).toHaveBeenCalledWith("/projects/p-1?task=t-1", {
      scroll: false,
    });

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

    expect(router.replace).toHaveBeenCalledWith("/projects/p-1?task=t-2", {
      scroll: false,
    });
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

    expect(router.replace).toHaveBeenCalledWith("/projects/p-1", {
      scroll: false,
    });
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

  it("UX-43: a load that was too fast shows the rate-limited page; Try again loads it after the wait (Refs #169)", async () => {
    pathname = "/projects/none";
    let limited = true;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/none") {
        if (limited)
          return json(429, {
            error: {
              code: "error.rate_limited",
              retry_after: 1,
              limit: { max: 20, window: 1 },
            },
          });
        return json(200, {
          project: null,
          progress: { done: 0, total: 1 },
          open: [task({ id: "t-1", title: "Back again", project_id: null })],
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
            <ProjectPage params={Promise.resolve({ id: "none" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    expect(
      await screen.findByRole("heading", { name: t("rate.burst_title") }),
    ).toBeTruthy();
    limited = false;
    const again = await screen.findByRole(
      "button",
      { name: t("rate.try_again") },
      { timeout: 2500 },
    );
    await userEvent.click(again);

    expect(await screen.findByText("Back again")).toBeTruthy();
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
      if (url === "/api/v1/counts")
        return json(200, { inbox: 0, upcoming: 0, no_project: 1, notes: 0 });
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

  it("displays server progress accurately when completed tasks are paginated", async () => {
    pathname = "/projects/p-paginated";
    const paginatedProjectData = {
      project: {
        id: "p-paginated",
        name: "Personal",
        colour: "purple",
        open: 8,
        done: 44,
        created_at: "2026-09-01T08:00:00Z",
      },
      progress: { done: 44, total: 52 },
      open: Array.from({ length: 8 }, (_, i) =>
        task({
          id: `t-open-${i}`,
          title: `Open Task ${i}`,
          project_id: "p-paginated",
        }),
      ),
      completed: Array.from({ length: 10 }, (_, i) =>
        task({
          id: `t-done-${i}`,
          title: `Done Task ${i}`,
          project_id: "p-paginated",
          done: true,
          done_at: "2026-10-23T10:00:00Z",
        }),
      ),
      next_cursor: "cursor-token",
    };

    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-paginated")
        return json(200, paginatedProjectData);
      if (url === "/api/v1/projects")
        return json(200, [paginatedProjectData.project]);
      if (url === "/api/v1/tasks/inbox") return json(200, {});
      return json(200, []);
    });

    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-paginated" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    // Confirms progress text displays 44 of 52 tasks completed, NOT 10 of 18
    expect(screen.getByText("44 of 52 tasks completed")).toBeTruthy();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("44");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("52");
  });

  it("keeps completed repeating occurrences, does not duplicate on scope=one delete + Undo, and lets the restored task be ticked", async () => {
    const done1 = task({
      id: "rep-done-1",
      title: "Weekly review",
      project_id: "p-1",
      done: true,
      done_at: "2027-01-01T17:00:00Z",
      start_date: "2027-01-01",
      due_date: "2027-01-02",
      repeat: "weekly",
    });
    const done2 = task({
      id: "rep-done-2",
      title: "Weekly review",
      project_id: "p-1",
      done: true,
      done_at: "2027-01-08T17:00:00Z",
      start_date: "2027-01-08",
      due_date: "2027-01-09",
      repeat: "weekly",
      previous_occurrence_id: "rep-done-1",
    });
    const open1 = task({
      id: "rep-open-1",
      title: "Weekly review",
      project_id: "p-1",
      done: false,
      start_date: "2027-01-15",
      due_date: "2027-01-16",
      repeat: "weekly",
      previous_occurrence_id: "rep-done-2",
    });
    const openNext = task({
      id: "rep-open-2",
      title: "Weekly review",
      project_id: "p-1",
      done: false,
      start_date: "2027-01-22",
      due_date: "2027-01-23",
      repeat: "weekly",
      previous_occurrence_id: "rep-open-1",
    });

    const completeCalls: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1")
        return json(200, {
          project: {
            id: "p-1",
            name: "Personal",
            colour: "purple",
            open: 1,
            done: 2,
          },
          progress: { done: 2, total: 3 },
          open: [open1],
          completed: [done2, done1],
          next_cursor: null,
        });
      if (url === "/api/v1/projects")
        return json(200, [{ id: "p-1", name: "Personal", colour: "purple" }]);
      if (url === "/api/v1/tasks/rep-open-1?scope=one" && method === "DELETE")
        return json(200, { next: openNext });
      if (url === "/api/v1/tasks/rep-open-1/restore" && method === "POST")
        return json(200, open1);
      if (url === "/api/v1/tasks/rep-open-1/complete" && method === "POST") {
        completeCalls.push(url);
        return json(200, {
          task: { ...open1, done: true, done_at: "2027-01-15T17:00:00Z" },
          next: openNext,
        });
      }
      return json(200, []);
    });

    searchParams = new URLSearchParams("task=rep-open-1");
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    await screen.findByText("2 of 3 tasks completed");
    const panel = screen.getByRole("complementary", {
      name: t("task.heading"),
    });

    // Delete only this occurrence (checkbox unchecked -> scope=one)
    await userEvent.click(
      within(panel).getByRole("button", { name: t("common.delete") }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: t("task.repeat_scope_title"),
    });
    const checkbox = within(dialog).getByRole("checkbox", {
      name: t("task.repeat_delete_all"),
    });
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("common.delete") }),
    );

    // Next occurrence appears, done occurrences stay in Completed
    const main = screen.getByRole("main");
    await within(main).findByRole("link", { name: /Fri 22 Jan 2027/ });
    expect(
      within(main).queryByRole("link", { name: /Fri 15 Jan 2027/ }),
    ).toBeNull();
    expect(
      within(main).getByRole("link", { name: /Fri 8 Jan 2027/ }),
    ).toBeTruthy();
    expect(
      within(main).getByRole("link", { name: /Fri 1 Jan 2027/ }),
    ).toBeTruthy();
    expect(within(main).getByText("2 of 3 tasks completed")).toBeTruthy();

    // Undo restores Fri 15 Jan 2027 and removes Fri 22 Jan 2027 with zero duplicates
    await userEvent.click(
      screen.getByRole("button", { name: t("common.undo") }),
    );
    await within(main).findByRole("link", { name: /Fri 15 Jan 2027/ });
    expect(
      within(main).queryByRole("link", { name: /Fri 22 Jan 2027/ }),
    ).toBeNull();
    expect(
      within(main).getAllByRole("link", { name: /Weekly review/ }),
    ).toHaveLength(3);
    expect(within(main).getByText("2 of 3 tasks completed")).toBeTruthy();

    // Ticking the restored task saves cleanly without error
    const checkboxes = within(main).getAllByRole("checkbox", {
      name: /Complete Weekly review/,
    });
    expect(checkboxes).toHaveLength(2);
    await userEvent.click(checkboxes[0]!);
    expect(completeCalls).toEqual(["/api/v1/tasks/rep-open-1/complete"]);
    expect(screen.queryByText(t("error.save_failed"))).toBeNull();
  });

  it("deletes the entire repeating series on scope=future and restores all occurrences on Undo", async () => {
    const done1 = task({
      id: "rep-done-1",
      title: "Weekly review",
      project_id: "p-1",
      done: true,
      done_at: "2027-01-01T17:00:00Z",
      start_date: "2027-01-01",
      due_date: "2027-01-02",
      repeat: "weekly",
    });
    const open1 = task({
      id: "rep-open-1",
      title: "Weekly review",
      project_id: "p-1",
      done: false,
      start_date: "2027-01-15",
      due_date: "2027-01-16",
      repeat: "weekly",
      previous_occurrence_id: "rep-done-1",
    });

    const restoredIds: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/v1/me")
        return json(200, { id: 1, email: "u@test.com" });
      if (url === "/api/v1/projects/p-1")
        return json(200, {
          project: {
            id: "p-1",
            name: "Personal",
            colour: "purple",
            open: 1,
            done: 1,
          },
          progress: { done: 1, total: 2 },
          open: [open1],
          completed: [done1],
          next_cursor: null,
        });
      if (url === "/api/v1/projects")
        return json(200, [{ id: "p-1", name: "Personal", colour: "purple" }]);
      if (
        url === "/api/v1/tasks/rep-open-1?scope=future" &&
        method === "DELETE"
      )
        return json(200, { deleted_ids: ["rep-done-1", "rep-open-1"] });
      if (url === "/api/v1/tasks/rep-done-1/restore" && method === "POST") {
        restoredIds.push("rep-done-1");
        return json(200, done1);
      }
      if (url === "/api/v1/tasks/rep-open-1/restore" && method === "POST") {
        restoredIds.push("rep-open-1");
        return json(200, open1);
      }
      return json(200, []);
    });

    searchParams = new URLSearchParams("task=rep-open-1");
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <ProjectPage params={Promise.resolve({ id: "p-1" })} />
          </Suspense>
        </AppFrame>,
      );
    });

    await screen.findByText("1 of 2 tasks completed");
    const panel = screen.getByRole("complementary", {
      name: t("task.heading"),
    });

    await userEvent.click(
      within(panel).getByRole("button", { name: t("common.delete") }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: t("task.repeat_scope_title"),
    });
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: t("task.repeat_delete_all"),
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("common.delete") }),
    );

    const main = screen.getByRole("main");
    await within(main).findByText(t("project.empty"));
    expect(
      within(main).queryByRole("link", { name: /Weekly review/ }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: t("common.undo") }),
    );
    await within(main).findByRole("link", { name: /Fri 15 Jan 2027/ });
    expect(
      within(main).getByRole("link", { name: /Fri 1 Jan 2027/ }),
    ).toBeTruthy();
    expect(within(main).getByText("1 of 2 tasks completed")).toBeTruthy();
    expect(restoredIds).toEqual(["rep-done-1", "rep-open-1"]);
  });
});
