import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UpcomingScreen,
  addDays,
  upcomingPage,
  type Clock,
  type Task,
  type TaskApi,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { projects, task } from "./fixtures";
import { TODAY } from "./harness";
import { createMemoryApi } from "./memoryApi";
import { TaskStoreProvider } from "../../src/ui/features/tasks/store";

const tomorrow = addDays(TODAY, 1);

const tuesdayClock: Clock = {
  now: () => new Date("2026-11-03T01:00:00Z"),
  timeZone: "Asia/Ho_Chi_Minh",
};

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  elements = new Set<Element>();
  static instances: MockIntersectionObserver[] = [];

  constructor(
    public callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    if (options?.rootMargin) this.rootMargin = options.rootMargin;
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this);
  }
}

class MockResizeObserver implements ResizeObserver {
  elements = new Set<Element>();
  static instances: MockResizeObserver[] = [];

  constructor(public callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  trigger(entries: Partial<ResizeObserverEntry>[]) {
    this.callback(entries as ResizeObserverEntry[], this);
  }
}

function setupUpcoming(
  tasks: Task[] = [],
  customApi?: TaskApi,
  customClock: Clock = tuesdayClock,
) {
  const memory = createMemoryApi({ tasks, projects });
  const api = customApi ?? memory.api;
  const wrap = (ui: ReactNode) => (
    <TaskStoreProvider
      api={api}
      clock={customClock}
      initialTasks={tasks}
      initialProjects={projects}
    >
      <main>{ui}</main>
    </TaskStoreProvider>
  );
  return { memory, wrap };
}

// The Upcoming screen from the design
const designTasks = () => [
  task({
    title: "Draft portfolio case study",
    project_id: "p-port",
    due_date: "2026-10-24",
    start_time: "10:00",
    end_time: "12:00",
  }),
  task({
    title: "Plan the week",
    due_date: "2026-10-25",
    start_time: "19:00",
    reminder: "15m",
    repeat: "weekly",
  }),
  task({
    title: "Renew gym membership",
    project_id: "p-pers",
    due_date: "2026-10-25",
    priority: "medium",
  }),
  task({
    title: "SQL quiz",
    project_id: "p-sql",
    due_date: "2026-10-26",
    start_time: "09:00",
    reminder: "1h",
    priority: "high",
  }),
  task({
    title: "Adv Web sprint demo",
    project_id: "p-web",
    due_date: "2026-10-26",
    start_time: "14:00",
    end_time: "15:00",
    reminder: "15m",
  }),
  task({ title: "Today, not upcoming", due_date: TODAY }),
  task({
    title: "Done, hidden",
    due_date: "2026-10-26",
    done: true,
    done_at: "2026-10-22T08:00:00Z",
  }),
];

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  MockIntersectionObserver.instances = [];
  MockResizeObserver.instances = [];
});

describe("upcomingPage (LV-2, T-LV-10)", () => {
  it("groups open tasks by day from tomorrow, sorted within the day", () => {
    const page = upcomingPage(designTasks(), tomorrow, "all");
    expect(page.days.map((d) => [d.date, d.tasks.map((x) => x.title)])).toEqual(
      [
        ["2026-10-24", ["Draft portfolio case study"]],
        ["2026-10-25", ["Plan the week", "Renew gym membership"]],
        ["2026-10-26", ["SQL quiz", "Adv Web sprint demo"]],
      ],
    );
    expect(page.nextFrom).toBeNull();
  });

  it("loads 14 days at a time, and a long gap moves to the next date with tasks", () => {
    const tasks = [
      task({ title: "a", due_date: "2026-10-24" }),
      task({ title: "b", due_date: "2026-11-06" }),
      task({ title: "c", due_date: "2026-11-07" }),
      task({ title: "d", due_date: "2027-03-01" }),
    ];
    const first = upcomingPage(tasks, tomorrow, "all");
    expect(first.days.map((d) => d.date)).toEqual(["2026-10-24", "2026-11-06"]);
    expect(first.nextFrom).toBe("2026-11-07");
    const second = upcomingPage(tasks, first.nextFrom!, "all");
    expect(second.days.map((d) => d.date)).toEqual(["2026-11-07"]);
    expect(second.nextFrom).toBe("2027-03-01");
  });

  it("filters Scheduled and Due only (T-LV-11)", () => {
    const titles = (f: "scheduled" | "due") =>
      upcomingPage(designTasks(), tomorrow, f).days.flatMap((d) =>
        d.tasks.map((x) => x.title),
      );
    expect(titles("scheduled")).toEqual([
      "Draft portfolio case study",
      "Plan the week",
      "SQL quiz",
      "Adv Web sprint demo",
    ]);
    expect(titles("due")).toEqual(["Renew gym membership"]);
  });
});

describe("Upcoming screen (Section 8)", () => {
  it("the week bar shows Mon 2 … Sun 8, Tue 3 is today (marker), month label November 2026, prev disabled", () => {
    const { wrap } = setupUpcoming();
    render(wrap(<UpcomingScreen accountInitial="e" />));

    expect(screen.getByText("November 2026")).toBeTruthy();

    const prevBtn = screen.getByRole("button", {
      name: "Previous week",
    }) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    const nextBtn = screen.getByRole("button", {
      name: "Next week",
    }) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);

    const tue3Btn = screen.getByRole("button", {
      name: /^3 Nov · Today · Tuesday,/,
    }) as HTMLButtonElement;
    expect(within(tue3Btn).getByText("Tue")).toBeTruthy();
    expect(tue3Btn.getAttribute("aria-current")).toBe("date");
    expect(tue3Btn.disabled).toBe(true);
    const badge = within(tue3Btn).getByText("3");
    expect(badge.className).toContain("bg-fill");

    const wed4Btn = screen.getByRole("button", {
      name: /^4 Nov · Tomorrow · Wednesday,/,
    }) as HTMLButtonElement;
    expect(wed4Btn.disabled).toBe(false);

    for (const d of [2, 3, 4, 5, 6, 7, 8]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${d} Nov.*tasks$`) }),
      ).toBeTruthy();
    }
  });

  it("next week shows Mon 9 … Sun 15 and previous becomes enabled; Tomorrow returns", async () => {
    const { wrap } = setupUpcoming();
    render(wrap(<UpcomingScreen accountInitial="e" />));

    await userEvent.click(screen.getByRole("button", { name: "Next week" }));

    const prevBtn = screen.getByRole("button", {
      name: "Previous week",
    }) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(false);

    for (const d of [9, 10, 11, 12, 13, 14, 15]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${d} Nov.*tasks$`) }),
      ).toBeTruthy();
    }

    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Previous week",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /^3 Nov · Today · Tuesday,/ }),
    ).toBeTruthy();
  });

  it("No 3 Nov · Today section and no Add task on 3 Nov … button; the first day section is 4 Nov · Tomorrow · Wednesday", () => {
    const { wrap } = setupUpcoming();
    render(wrap(<UpcomingScreen accountInitial="e" />));

    expect(
      screen.queryByRole("heading", { name: /^3 Nov · Today\b/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /^Add task on 3 Nov\b/,
      }),
    ).toBeNull();

    expect(
      screen.getByRole("heading", { name: "4 Nov · Tomorrow · Wednesday" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "5 Nov · Thursday" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "6 Nov · Friday" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "7 Nov · Saturday" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "8 Nov · Sunday" }),
    ).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "Add task on 4 Nov · Tomorrow · Wednesday",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Add task on 5 Nov · Thursday",
      }),
    ).toBeTruthy();
  });

  it("clicking Add task on 5 Nov · Thursday opens New task with that date", async () => {
    const onAddTask = vi.fn();
    const { wrap } = setupUpcoming();
    render(wrap(<UpcomingScreen accountInitial="e" onAddTask={onAddTask} />));

    await userEvent.click(
      screen.getByRole("button", { name: "Add task on 5 Nov · Thursday" }),
    );
    expect(onAddTask).toHaveBeenCalledWith("2026-11-05");
  });

  it("with weekStart sun and today Tuesday, Sunday 1, Monday 2 and Tuesday 3 are disabled; 4 Nov is the first section", () => {
    const { wrap } = setupUpcoming();
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="sun" />));

    const sun1Btn = screen.getByRole("button", {
      name: /^1 Nov.*tasks$/,
    }) as HTMLButtonElement;
    expect(sun1Btn.disabled).toBe(true);

    const mon2Btn = screen.getByRole("button", {
      name: /^2 Nov.*tasks$/,
    }) as HTMLButtonElement;
    expect(mon2Btn.disabled).toBe(true);

    const tue3Btn = screen.getByRole("button", {
      name: /^3 Nov.*tasks$/,
    }) as HTMLButtonElement;
    expect(tue3Btn.disabled).toBe(true);

    expect(screen.queryByRole("heading", { name: /^1 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^2 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^3 Nov\b/ })).toBeNull();

    expect(
      screen.getByRole("heading", { name: "4 Nov · Tomorrow · Wednesday" }),
    ).toBeTruthy();
  });

  it("Board: switching to Board (labels List/Board, no Vietnamese) shows columns starting 4 Nov; choice remembered; old stored grid opens Board", async () => {
    const { wrap } = setupUpcoming();
    const { unmount } = render(wrap(<UpcomingScreen accountInitial="e" />));

    expect(screen.getByRole("button", { name: "List" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Board" })).toBeTruthy();
    expect(screen.queryByText("Ngang")).toBeNull();
    expect(screen.queryByText("Dọc")).toBeNull();
    expect(screen.queryByLabelText("Chế độ xem")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(localStorage.getItem("agendal.upcoming.view_mode")).toBe("board");

    expect(screen.queryByRole("heading", { name: /^3 Nov\b/ })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "4 Nov · Tomorrow" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "5 Nov · Thursday" }),
    ).toBeTruthy();

    unmount();

    localStorage.setItem("agendal.upcoming.view_mode", "grid");
    render(wrap(<UpcomingScreen accountInitial="e" />));
    expect(
      screen
        .getByRole("button", { name: "Board" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("heading", { name: "4 Nov · Tomorrow" }),
    ).toBeTruthy();
  });

  it("List: with one overdue task (due 2026-11-01), an Overdue 1 section comes before 4 Nov with showDue and overdue style, and no Add task button; without overdue tasks: no Overdue section", () => {
    const overdueTask = task({
      id: "t-overdue",
      title: "Overdue item",
      due_date: "2026-11-01",
    });
    const upcomingTask = task({
      id: "t-up-1",
      title: "Tomorrow item",
      due_date: "2026-11-04",
    });
    const { wrap } = setupUpcoming([overdueTask, upcomingTask]);
    const { unmount } = render(wrap(<UpcomingScreen accountInitial="e" />));

    const overdueHeading = screen.getByRole("heading", { name: /^Overdue 1/ });
    expect(overdueHeading).toBeTruthy();
    expect(overdueHeading.id).toBe("day-overdue");
    expect(overdueHeading.className).toContain("text-error");

    const overdueSection = overdueHeading.closest("section");
    expect(overdueSection).toBeTruthy();
    expect(
      within(overdueSection!).getByRole("link", { name: /Overdue item/ }),
    ).toBeTruthy();
    expect(
      within(overdueSection!).queryByRole("button", { name: /Add task/ }),
    ).toBeNull();

    const row = within(overdueSection!)
      .getByRole("link", { name: /Overdue item/ })
      .closest("li");
    expect(
      row?.querySelector(".is-overdue") ??
        row?.className.includes("is-overdue"),
    ).toBeTruthy();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    const overdueIdx = headings.findIndex((h) => h?.includes("Overdue"));
    const nov4Idx = headings.findIndex((h) => h?.includes("4 Nov"));
    expect(overdueIdx).toBeLessThan(nov4Idx);

    unmount();

    const { wrap: wrapNoOverdue } = setupUpcoming([upcomingTask]);
    render(wrapNoOverdue(<UpcomingScreen accountInitial="e" />));
    expect(screen.queryByRole("heading", { name: /Overdue/ })).toBeNull();
  });

  it("Board: first column 'Overdue' when overdue tasks exist, then 4 Nov …; no 3 Nov column", () => {
    const overdueTask = task({
      id: "t-overdue",
      title: "Overdue board item",
      due_date: "2026-11-01",
    });
    const { wrap } = setupUpcoming([overdueTask]);
    render(
      wrap(
        <UpcomingScreen accountInitial="e" weekStart="mon" viewMode="board" />,
      ),
    );

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings[0]).toContain("Overdue");
    expect(headings[1]).toContain("4 Nov");
    expect(screen.queryByRole("heading", { name: /^3 Nov\b/ })).toBeNull();

    const overdueCol = screen
      .getByRole("heading", { name: "Overdue" })
      .closest("section");
    expect(overdueCol).toBeTruthy();
    expect(
      within(overdueCol!).getByRole("link", { name: /Overdue board item/ }),
    ).toBeTruthy();
    expect(
      within(overdueCol!).queryByRole("button", { name: /Add task/ }),
    ).toBeNull();
  });

  it("Strip: Tue 3 has aria-current='date' and is disabled; Wed 4 is enabled", () => {
    const { wrap } = setupUpcoming();
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    const tue3Btn = screen.getByRole("button", {
      name: /^3 Nov.*tasks$/,
    }) as HTMLButtonElement;
    expect(tue3Btn.getAttribute("aria-current")).toBe("date");
    expect(tue3Btn.disabled).toBe(true);

    const wed4Btn = screen.getByRole("button", {
      name: /^4 Nov.*tasks$/,
    }) as HTMLButtonElement;
    expect(wed4Btn.disabled).toBe(false);
  });

  it("axe clean in both themes for List view", async () => {
    const { wrap } = setupUpcoming([
      task({ title: "Task 1", due_date: "2026-11-04" }),
    ]);
    render(wrap(<UpcomingScreen accountInitial="e" viewMode="list" />));
    await expectAxeCleanInBothThemes();
  });

  it("axe clean in both themes for Board view", async () => {
    const { wrap } = setupUpcoming([
      task({ title: "Task 1", due_date: "2026-11-04" }),
    ]);
    render(wrap(<UpcomingScreen accountInitial="e" viewMode="board" />));
    await expectAxeCleanInBothThemes();
  });

  it("completing a row keeps it ticked with aria-disabled='true'", async () => {
    const fakeTask = task({
      id: "t-up-1",
      title: "Complete me",
      due_date: "2026-11-04",
    });
    const memory = createMemoryApi({ tasks: [fakeTask], projects });
    const reopenSpy = vi.spyOn(memory.api, "reopen");
    const { wrap } = setupUpcoming([fakeTask], memory.api);

    render(wrap(<UpcomingScreen accountInitial="e" />));

    const checkBtn = screen.getByRole("checkbox", {
      name: "Complete Complete me",
    });
    await userEvent.click(checkBtn);

    expect(checkBtn.getAttribute("aria-checked")).toBe("true");
    expect(checkBtn.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(checkBtn);
    expect(reopenSpy).not.toHaveBeenCalled();
  });

  it("List: renders exactly the days of the anchor week + next week from today (today Tue 2026-11-03, weekStart mon -> 4 Nov … 15 Nov, 12 days); no 16 Nov; no sentinel; › -> 9 Nov … 22 Nov window and ‹ enabled; Tomorrow -> back", async () => {
    const { wrap } = setupUpcoming([], undefined, tuesdayClock);
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    expect(screen.queryByTestId("upcoming-sentinel")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^2 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^3 Nov\b/ })).toBeNull();

    for (const d of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
      expect(
        screen.getByRole("heading", { name: new RegExp(`^${d} Nov\\b`) }),
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: /^16 Nov\b/ })).toBeNull();

    const prevBtn = screen.getByRole("button", {
      name: "Previous week",
    }) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(prevBtn.disabled).toBe(false);

    for (const d of [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) {
      expect(
        screen.getByRole("heading", { name: new RegExp(`^${d} Nov\\b`) }),
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: /^8 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^23 Nov\b/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(prevBtn.disabled).toBe(true);
    expect(screen.getByRole("heading", { name: /^4 Nov\b/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^3 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^16 Nov\b/ })).toBeNull();
  });

  it("Board: no day-strip buttons, Days of the week group absent in Board; columns 4 Nov … 8 Nov; › -> 9 … 15 Nov", async () => {
    const { wrap } = setupUpcoming([], undefined, tuesdayClock);
    render(
      wrap(
        <UpcomingScreen accountInitial="e" weekStart="mon" viewMode="board" />,
      ),
    );

    expect(
      screen.queryByRole("group", { name: "Days of the week" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^3 Nov.*tasks$/ })).toBeNull();

    for (const d of [4, 5, 6, 7, 8]) {
      expect(
        screen.getByRole("heading", { name: new RegExp(`^${d} Nov\\b`) }),
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: /^2 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^3 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^9 Nov\b/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Next week" }));

    for (const d of [9, 10, 11, 12, 13, 14, 15]) {
      expect(
        screen.getByRole("heading", { name: new RegExp(`^${d} Nov\\b`) }),
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: /^8 Nov\b/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^16 Nov\b/ })).toBeNull();
  });

  it("Strip: when the active day is Thu 5, today's (Tue 3) number keeps the soft pill (bg-fill) and the active one has bg-primary", () => {
    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    try {
      const { wrap } = setupUpcoming([], undefined, tuesdayClock);
      render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

      const heading5 = document.getElementById("day-2026-11-05");
      expect(heading5).toBeTruthy();

      const observer = MockIntersectionObserver.instances.find((inst) =>
        inst.elements.has(heading5!),
      );
      expect(observer).toBeTruthy();

      act(() => {
        observer!.trigger([
          {
            target: heading5!,
            isIntersecting: true,
          },
        ]);
      });

      const tue3Btn = screen.getByRole("button", { name: /^3 Nov.*tasks$/ });
      const tue3Number = within(tue3Btn).getByText("3");
      expect(tue3Number.className).toContain("bg-fill");
      expect(tue3Number.className).not.toContain("bg-primary");

      const thu5Btn = screen.getByRole("button", { name: /^5 Nov.*tasks$/ });
      const thu5Number = within(thu5Btn).getByText("5");
      expect(thu5Number.className).toContain("bg-primary");
      expect(thu5Number.className).not.toContain("bg-fill");
    } finally {
      window.IntersectionObserver = originalIO;
    }
  });

  it("strip: Mon 2 disabled; Tue 3 has aria-current='date'; day with tasks has dot element, day without doesn't", () => {
    const tasks = [
      task({ id: "t-1", title: "Task on Thu", due_date: "2026-11-05" }),
    ];
    const { wrap } = setupUpcoming(tasks, undefined, tuesdayClock);
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    const mon2Btn = screen.getByRole("button", {
      name: /^2 Nov.*tasks$/,
    }) as HTMLButtonElement;
    expect(mon2Btn.disabled).toBe(true);

    const tue3Btn = screen.getByRole("button", {
      name: /^3 Nov.*tasks$/,
    });
    expect(tue3Btn.getAttribute("aria-current")).toBe("date");

    const thu5Btn = screen.getByRole("button", {
      name: /^5 Nov.*tasks$/,
    });
    expect(within(thu5Btn).getByTestId("day-dot")).toBeTruthy();

    const wed4Btn = screen.getByRole("button", {
      name: /^4 Nov.*tasks$/,
    });
    expect(within(wed4Btn).queryByTestId("day-dot")).toBeNull();
  });

  it("mock IntersectionObserver: triggering day-2026-11-10 intersecting updates strip to Mon 9 … Sun 15 and November 2026, Tue 10 active pill", () => {
    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    try {
      const { wrap } = setupUpcoming([], undefined, tuesdayClock);
      render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

      const heading10 = document.getElementById("day-2026-11-10");
      expect(heading10).toBeTruthy();

      const observer = MockIntersectionObserver.instances.find((inst) =>
        inst.elements.has(heading10!),
      );
      expect(observer).toBeTruthy();

      act(() => {
        observer!.trigger([
          {
            target: heading10!,
            isIntersecting: true,
          },
        ]);
      });

      expect(screen.getByText("November 2026")).toBeTruthy();
      for (const d of [9, 10, 11, 12, 13, 14, 15]) {
        expect(
          screen.getByRole("button", {
            name: new RegExp(`^${d} Nov.*tasks$`),
          }),
        ).toBeTruthy();
      }

      const tue10Btn = screen.getByRole("button", {
        name: /^10 Nov.*tasks$/,
      });
      expect(tue10Btn.getAttribute("aria-current")).toBe("true");
      const badge = within(tue10Btn).getByText("10");
      expect(badge.className).toContain("bg-primary");
      expect(badge.className).toContain("text-primary-content");
    } finally {
      window.IntersectionObserver = originalIO;
    }
  });

  it("clicking Thu 5 calls scrollIntoView on #day-2026-11-05", async () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const { wrap } = setupUpcoming([], undefined, tuesdayClock);
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    const thu5Btn = screen.getByRole("button", {
      name: /^5 Nov.*tasks$/,
    });
    await userEvent.click(thu5Btn);

    const targetEl = document.getElementById("day-2026-11-05");
    expect(targetEl).toBeTruthy();
    expect(scrollSpy).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
    expect(scrollSpy.mock.instances).toContain(targetEl);
  });

  it("the last day section's class contains min-h-[calc(100dvh-var(--upcoming-bar-h and no other section has it", () => {
    const { wrap } = setupUpcoming([], undefined, tuesdayClock);
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    const sections = Array.from(
      document.querySelectorAll("section[aria-label]"),
    );
    expect(sections.length).toBeGreaterThan(1);
    const lastSection = sections[sections.length - 1];

    expect(lastSection.className).toContain(
      "min-h-[calc(100dvh-var(--upcoming-bar-h",
    );
    for (let i = 0; i < sections.length - 1; i++) {
      expect(sections[i].className).not.toContain(
        "min-h-[calc(100dvh-var(--upcoming-bar-h",
      );
    }
  });

  it("headings use scroll-mt-[calc(var(--upcoming-bar-h in both list and board views", async () => {
    const { wrap } = setupUpcoming([], undefined, tuesdayClock);
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    const listHeading = document.getElementById("day-2026-11-04");
    expect(listHeading?.className).toContain(
      "scroll-mt-[calc(var(--upcoming-bar-h",
    );

    const boardBtn = screen.getByRole("button", { name: "Board" });
    await userEvent.click(boardBtn);

    const boardHeading = document.getElementById("day-2026-11-04");
    expect(boardHeading?.className).toContain(
      "scroll-mt-[calc(var(--upcoming-bar-h",
    );
  });

  it("bottom fallback: stub window at bottom, dispatch scroll -> strip active pill on last visible day", () => {
    const originalInnerHeight = window.innerHeight;
    const originalScrollY = window.scrollY;
    try {
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 800,
      });
      Object.defineProperty(window, "scrollY", {
        writable: true,
        configurable: true,
        value: 1200,
      });
      Object.defineProperty(document.documentElement, "scrollHeight", {
        writable: true,
        configurable: true,
        value: 2000,
      });

      const { wrap } = setupUpcoming([], undefined, tuesdayClock);
      render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

      const tue3Btn = screen.getByRole("button", {
        name: /^3 Nov.*tasks$/,
      });
      expect(tue3Btn.getAttribute("aria-current")).toBe("date");

      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });

      const sun15Btn = screen.getByRole("button", {
        name: /^15 Nov.*tasks$/,
      });
      expect(sun15Btn.getAttribute("aria-current")).toBe("true");
      const badge = within(sun15Btn).getByText("15");
      expect(badge.className).toContain("bg-primary");
      expect(badge.className).toContain("text-primary-content");
    } finally {
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      });
      Object.defineProperty(window, "scrollY", {
        writable: true,
        configurable: true,
        value: originalScrollY,
      });
    }
  });

  it("clicking Sun 15 (after › to that week, or a window containing it) calls scrollIntoView on #day-2026-11-15", async () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const { wrap } = setupUpcoming([], undefined, tuesdayClock);
    render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

    const nextBtn = screen.getByRole("button", { name: "Next week" });
    await userEvent.click(nextBtn);

    const sun15Btn = screen.getByRole("button", {
      name: /^15 Nov.*tasks$/,
    });
    await userEvent.click(sun15Btn);

    const targetEl = document.getElementById("day-2026-11-15");
    expect(targetEl).toBeTruthy();
    expect(scrollSpy).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
    expect(scrollSpy.mock.instances).toContain(targetEl);
  });

  it("measures sticky bar via ResizeObserver and sets --upcoming-bar-h on list wrapper", () => {
    const originalRO = window.ResizeObserver;
    window.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
    try {
      const { wrap } = setupUpcoming([], undefined, tuesdayClock);
      render(wrap(<UpcomingScreen accountInitial="e" weekStart="mon" />));

      const observer = MockResizeObserver.instances[0];
      expect(observer).toBeTruthy();

      const stickyBar = Array.from(observer.elements)[0];
      expect(stickyBar).toBeTruthy();

      act(() => {
        observer.trigger([
          {
            target: stickyBar,
            contentRect: { height: 135 } as DOMRectReadOnly,
          },
        ]);
      });

      const listWrapper = document
        .getElementById("day-2026-11-04")
        ?.closest(".mt-6");
      expect(listWrapper?.getAttribute("style")).toContain(
        "--upcoming-bar-h: 135px",
      );
    } finally {
      window.ResizeObserver = originalRO;
    }
  });
});
