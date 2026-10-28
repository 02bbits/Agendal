import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { UpcomingScreen, addDays, upcomingPage } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { task } from "./fixtures";
import { TODAY, setup } from "./harness";

const tomorrow = addDays(TODAY, 1);

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

afterEach(() => localStorage.clear());

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

describe("Upcoming screen", () => {
  it("matches the design: Tomorrow then dates, with counts", async () => {
    const { wrap } = setup(designTasks());
    render(wrap(<UpcomingScreen accountInitial="e" />));
    expect(screen.getByText("From tomorrow")).toBeTruthy();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.querySelector(".sr-only")!.textContent);
    expect(headings).toEqual([
      "Tomorrow, 1 task",
      "Sun 25 Oct, 2 tasks",
      "Mon 26 Oct, 2 tasks",
    ]);
    expect(screen.queryByText("Today, not upcoming")).toBeNull();
    expect(screen.queryByText("Done, hidden")).toBeNull();
    await expectAxeCleanInBothThemes();
  });

  it("filters with a radio group and remembers the choice on this device", async () => {
    const { wrap } = setup(designTasks());
    const { unmount } = render(wrap(<UpcomingScreen accountInitial="e" />));
    const group = screen.getByRole("radiogroup", { name: "Show" });
    await userEvent.click(
      within(group).getByRole("radio", { name: "Due only" }),
    );
    expect(
      screen
        .getAllByRole("link", { name: /,/ })
        .map((a) => a.querySelector('[data-slot="title"]')!.textContent),
    ).toEqual(["Renew gym membership"]);
    unmount();
    render(wrap(<UpcomingScreen accountInitial="e" />));
    expect(
      within(screen.getByRole("radiogroup", { name: "Show" }))
        .getByRole("radio", { name: "Due only" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it('shows "Nothing matches this filter" with Show all (LV-E12, T-LV-112)', async () => {
    const { wrap } = setup([
      task({ title: "Untimed", due_date: "2026-10-25" }),
    ]);
    render(wrap(<UpcomingScreen accountInitial="e" />));
    await userEvent.click(screen.getByRole("radio", { name: "Scheduled" }));
    expect(
      screen.getByRole("heading", { name: "Nothing matches this filter." }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(
      screen.getByRole("radio", { name: "All" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByText("Untimed")).toBeTruthy();
  });

  it("shows the empty state when nothing is coming up", () => {
    const { wrap } = setup([]);
    render(wrap(<UpcomingScreen accountInitial="e" />));
    expect(
      screen.getByRole("heading", {
        name: "Nothing coming up. Write a note to plan ahead.",
      }),
    ).toBeTruthy();
  });

  it("loads the next 14 days on request", async () => {
    const { wrap } = setup([
      task({ title: "Soon", due_date: "2026-10-24" }),
      task({ title: "Later", due_date: "2026-11-20" }),
    ]);
    render(wrap(<UpcomingScreen accountInitial="e" />));
    expect(screen.queryByText("Later")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Show more days" }),
    );
    expect(screen.getByText("Later")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more days" })).toBeNull();
  });
});
