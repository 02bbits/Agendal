import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  InboxScreen,
  TaskStoreProvider,
  buildInbox,
  type Clock,
} from "../../src/ui";
import Page from "../../src/app/page";
import { AppFrame } from "../../src/app/AppFrame";
import { createMemoryApi } from "./memoryApi";
import { expectAxeCleanInBothThemes } from "./axe";
import { projects, task } from "./fixtures";
import { TODAY, setup } from "./harness";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => router,
}));

const doneToday = (x: { done_at: string | null }) =>
  !!x.done_at && x.done_at.startsWith("2026-10-23");

// The Inbox from the design, on Friday 23 October
const designTasks = () => [
  task({
    title: "Submit HCI reflection",
    project_id: "p-hci",
    due_date: "2026-10-22",
    start_time: "23:59",
    priority: "high",
  }),
  task({
    title: "Review lecture 6 notes",
    project_id: "p-hci",
    due_date: TODAY,
    start_time: "16:00",
    end_time: "17:00",
    reminder: "15m",
  }),
  task({
    title: "Email the group",
    due_date: TODAY,
    start_time: "20:00",
    reminder: "15m",
    priority: "medium",
  }),
  task({
    title: "Pay phone bill",
    project_id: "p-pers",
    due_date: TODAY,
    priority: "medium",
  }),
  task({
    title: "Read chapter 4 for SQL",
    project_id: "p-sql",
    due_date: TODAY,
    done: true,
    done_at: "2026-10-23T01:00:00Z",
  }),
  task({ title: "Buy milk" }),
];

describe("buildInbox (LV-1)", () => {
  it("orders Overdue oldest first and Today by time, then priority, then created (T-LV-02)", () => {
    const tasks = [
      task({ title: "late 2", due_date: "2026-10-21" }),
      task({ title: "late 1", due_date: "2026-10-19" }),
      task({ title: "untimed low", due_date: TODAY }),
      task({ title: "timed 18", due_date: TODAY, start_time: "18:00" }),
      task({ title: "untimed high", due_date: TODAY, priority: "high" }),
      task({ title: "timed 09", due_date: TODAY, start_time: "09:00" }),
    ];
    const view = buildInbox(tasks, TODAY, { completedToday: doneToday });
    expect(view.overdue.map((x) => x.title)).toEqual(["late 1", "late 2"]);
    expect(view.today.map((x) => x.title)).toEqual([
      "timed 09",
      "timed 18",
      "untimed high",
      "untimed low",
    ]);
  });

  it("keeps a task due today in Today after its time passes; overdue is by date (LV-E9)", () => {
    const view = buildInbox(
      [task({ title: "early", due_date: TODAY, start_time: "06:00" })],
      TODAY,
      { completedToday: doneToday },
    );
    expect(view.overdue).toHaveLength(0);
    expect(view.today).toHaveLength(1);
  });

  it("puts undated tasks in No date by priority then newest, outside the progress (LV-E4)", () => {
    const view = buildInbox(
      [
        task({ title: "old low" }),
        task({ title: "new low" }),
        task({ title: "high", priority: "high" }),
      ],
      TODAY,
      { completedToday: doneToday },
    );
    expect(view.noDate.map((x) => x.title)).toEqual([
      "high",
      "new low",
      "old low",
    ]);
    expect(view.progress).toEqual({ done: 0, total: 0 });
  });
});

describe("Inbox screen", () => {
  it("matches the design: date overline, progress, Overdue then Today (T-LV-01, T-LV-02)", async () => {
    const { wrap } = setup(designTasks());
    render(wrap(<InboxScreen accountInitial="example" />));
    expect(screen.getByText(/Friday,? 23 October/)).toBeTruthy();
    expect(screen.getByText("1 down, 4 to go!")).toBeTruthy();
    expect(
      screen.getByText("Next: Review lecture 6 notes at 16:00"),
    ).toBeTruthy();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings.slice(0, 2)).toEqual([
      "Overdue1Overdue, 1 task",
      "Today3Today, 3 tasks",
    ]);
    await expectAxeCleanInBothThemes();
  });

  it("marks Overdue with the word and count, not colour alone (T-LV-03, A11Y-50)", () => {
    const { wrap } = setup(designTasks());
    render(wrap(<InboxScreen accountInitial="e" />));
    const overdue = screen.getByRole("heading", { name: /Overdue, 1 task/ });
    expect(overdue.querySelector(".text-error")!.textContent).toBe("Overdue");
    const row = within(overdue.closest("section")!).getByRole("link");
    expect(row.getAttribute("aria-label")).toBe(
      "Submit HCI reflection, Yesterday, 23:59, HCI, High priority",
    );
  });

  it("collapses No date and Completed as disclosures (A11Y-53)", async () => {
    const { wrap } = setup(designTasks());
    render(wrap(<InboxScreen accountInitial="e" />));
    const completed = screen.getByRole("button", { name: /Completed, 1 task/ });
    expect(completed.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("link", { name: /Read chapter 4 for SQL/ }),
    ).toBeNull();
    await userEvent.click(completed);
    expect(completed.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("link", { name: /Read chapter 4 for SQL/ }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /No date, 1 task/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it('shows "Nothing left for today" linking to Upcoming, and focuses it after the last tick (T-LV-04, T-LV-111)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { wrap } = setup([
        task({ title: "Last one", due_date: TODAY }),
        task({
          title: "Earlier",
          due_date: TODAY,
          done: true,
          done_at: "2026-10-23T00:10:00Z",
        }),
      ]);
      render(wrap(<InboxScreen accountInitial="e" />));
      await userEvent.click(
        screen.getByRole("checkbox", { name: "Complete Last one" }),
      );
      await act(async () => vi.advanceTimersByTime(700));
      const heading = await screen.findByRole("heading", {
        name: "Nothing left for today",
      });
      expect(document.activeElement).toBe(heading);
      expect(screen.getByText("Nice work!")).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: "See what's coming" })
          .getAttribute("href"),
      ).toBe("/upcoming");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the first-run state when there are no tasks at all", () => {
    const { wrap } = setup([]);
    render(wrap(<InboxScreen accountInitial="e" />));
    expect(
      screen.getByRole("heading", {
        name: "Write a note to make your first tasks.",
      }),
    ).toBeTruthy();
  });

  it("completing an overdue task counts toward today (LV-E3)", async () => {
    const { wrap } = setup([
      task({ title: "Late", due_date: "2026-10-20" }),
      task({ title: "Now", due_date: TODAY }),
    ]);
    render(wrap(<InboxScreen accountInitial="e" />));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Complete Late" }),
    );
    expect(screen.getByText("1 of 2 done")).toBeTruthy();
  });

  it("ticking a task moves it to Completed and updates progress (LV §2.1, TK §2.1)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { wrap } = setup([
        task({ title: "Task 1", due_date: TODAY }),
        task({ title: "Task 2", due_date: TODAY }),
      ]);
      render(wrap(<InboxScreen accountInitial="e" />));
      expect(screen.getByText("0 of 2 done")).toBeTruthy();
      expect(screen.getByRole("link", { name: /Task 1/ })).toBeTruthy();

      await userEvent.click(
        screen.getByRole("checkbox", { name: "Complete Task 1" }),
      );

      // Progress updates immediately
      expect(screen.getByText("1 of 2 done")).toBeTruthy();

      // Settle time: task moves to Completed
      await act(async () => vi.advanceTimersByTime(700));

      const completedBtn = screen.getByRole("button", {
        name: /Completed, 1 task/,
      });
      expect(completedBtn).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves yesterday’s open tasks to Overdue at midnight (LV-E1, T-LV-101)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-23T16:59:00Z")); // 23:59 in Ho Chi Minh City
      const clock: Clock = {
        now: () => new Date(),
        timeZone: "Asia/Ho_Chi_Minh",
      };
      const tasks = [task({ title: "Due tonight", due_date: TODAY })];
      const memory = createMemoryApi({ tasks, projects });
      render(
        <TaskStoreProvider
          api={memory.api}
          clock={clock}
          initialTasks={tasks}
          initialProjects={projects}
        >
          <main>
            <InboxScreen accountInitial="e" />
          </main>
        </TaskStoreProvider>,
      );
      expect(
        screen.getByRole("heading", { name: /Today, 1 task/ }),
      ).toBeTruthy();
      await act(async () => vi.advanceTimersByTime(2 * 60 * 1000));
      expect(
        screen.getByRole("heading", { name: /Overdue, 1 task/ }),
      ).toBeTruthy();
      expect(screen.getByText(/Saturday,? 24 October/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Inbox Page (app/page.tsx)", () => {
  it("stubs fetch and shows the loaded tasks from the API", async () => {
    const mockInbox = {
      overdue: [
        task({
          id: "t-overdue",
          title: "Overdue API task",
          due_date: "2026-10-20",
        }),
      ],
      today: [
        task({
          id: "t-today",
          title: "Today API task",
          due_date: TODAY,
        }),
      ],
      no_date: [
        task({
          id: "t-nodate",
          title: "No date API task",
          due_date: null,
        }),
      ],
      completed_today: [],
      progress: { done: 0, total: 2 },
      no_date_count: 1,
      completed_count: 0,
    };
    const mockProjects = [
      {
        id: "p-hci",
        name: "HCI",
        colour: "blue",
        created_at: "2026-10-20T00:00:00Z",
      },
    ];

    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string | URL | Request) => {
        const u =
          typeof url === "string"
            ? url
            : "url" in url
              ? url.url
              : url.toString();
        if (u.includes("/tasks?view=inbox")) {
          return new Response(JSON.stringify(mockInbox), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/projects")) {
          return new Response(JSON.stringify(mockProjects), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/user") || u.includes("/me")) {
          return new Response(
            JSON.stringify({
              id: 1,
              email: "test@example.com",
              display_name: "Test User",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200 });
      });

    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <AppFrame>
          <Page />
        </AppFrame>,
      );

      expect(await screen.findByText("Today API task")).toBeTruthy();
      expect(screen.getByText("Overdue API task")).toBeTruthy();
      await expectAxeCleanInBothThemes();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows error and retries on failure", async () => {
    let fail = true;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string | URL | Request) => {
        const u =
          typeof url === "string"
            ? url
            : "url" in url
              ? url.url
              : url.toString();
        if (u.includes("/user") || u.includes("/me")) {
          return new Response(
            JSON.stringify({
              id: 1,
              email: "test@example.com",
              display_name: "Test User",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (fail && u.includes("/tasks?view=inbox")) {
          return new Response("Server error", { status: 500 });
        }
        if (u.includes("/tasks?view=inbox")) {
          return new Response(
            JSON.stringify({
              overdue: [],
              today: [task({ title: "Recovered task", due_date: TODAY })],
              no_date: [],
              completed_today: [],
              progress: { done: 0, total: 1 },
              no_date_count: 0,
              completed_count: 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (u.includes("/projects")) {
          return new Response("[]", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 200 });
      });

    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <AppFrame>
          <Page />
        </AppFrame>,
      );

      expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
      fail = false;
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("Recovered task")).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
