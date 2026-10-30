import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  TaskRow,
  formatDay,
  formatLongDate,
  formatTime,
  formatTimeRange,
  todayIn,
  addDays,
  type Priority,
  type Reminder,
  type Repeat,
  type Task,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";
import { TODAY, projectById, task } from "./fixtures";

function renderRow(
  t: Task,
  props: Partial<Parameters<typeof TaskRow>[0]> = {},
) {
  return render(
    <main>
      <ul className="m-0 list-none p-0">
        <TaskRow
          task={t}
          project={projectById(t.project_id)}
          today={TODAY}
          timeFormat="24h"
          onToggle={() => {}}
          {...props}
        />
      </ul>
    </main>,
  );
}

describe("dates (UX-32)", () => {
  it("uses words for today, tomorrow and yesterday", () => {
    expect(formatDay(TODAY, TODAY)).toBe("Today");
    expect(formatDay(addDays(TODAY, 1), TODAY)).toBe("Tomorrow");
    expect(formatDay(addDays(TODAY, -1), TODAY)).toBe("Yesterday");
  });

  it("uses short dates, with the year only outside this year", () => {
    expect(formatDay("2026-10-26", TODAY)).toBe("Mon 26 Oct");
    expect(formatDay("2027-01-04", TODAY)).toBe("Mon 4 Jan 2027");
  });

  it("formats times in 24-hour or 12-hour and ranges with an en dash", () => {
    expect(formatTime("16:00", "24h")).toBe("16:00");
    expect(formatTime("16:00", "12h")).toBe("4:00 pm");
    expect(formatTime("00:30", "12h")).toBe("12:30 am");
    expect(formatTimeRange("16:00", "17:00", "24h")).toBe("16:00 – 17:00");
  });

  it("writes the overline date in full", () => {
    expect(formatLongDate(TODAY)).toBe("Friday 23 October");
  });

  it("computes today from an injected instant and zone (ADR-006)", () => {
    const instant = new Date("2026-10-23T18:30:00Z");
    expect(todayIn(instant, "Asia/Ho_Chi_Minh")).toBe("2026-10-24");
    expect(todayIn(instant, "America/New_York")).toBe("2026-10-23");
  });
});

describe("TaskRow (LV-4)", () => {
  it("shows project dot and name, time range, reminder and repeat (T-LV-30)", () => {
    const t = task({
      title: "Review lecture 6 notes",
      project_id: "p-hci",
      due_date: TODAY,
      start_time: "16:00",
      end_time: "17:00",
      reminder: "15m",
      repeat: "weekly",
    });
    const { container } = renderRow(t);
    const meta = container.querySelector('[data-slot="meta"]')!;
    expect(meta.textContent).toBe("HCI·16:00 – 17:00");
    expect(meta.querySelectorAll("svg")).toHaveLength(2);
    expect(
      (container.querySelector('[data-slot="dot"]') as HTMLElement).style
        .background,
    ).toBe("var(--color-project-orange)");
  });

  it('shows "No project" with a gray dot', () => {
    const { container } = renderRow(task({ title: "Email the group" }));
    expect(container.querySelector('[data-slot="meta"]')!.textContent).toBe(
      "No project",
    );
    expect(
      (container.querySelector('[data-slot="dot"]') as HTMLElement).style
        .background,
    ).toBe("var(--color-project-gray)");
  });

  const priorities: Array<[Priority | null, string | null]> = [
    ["high", "danger"],
    ["medium", "warning"],
    ["low", null],
    [null, null],
  ];
  it.each(priorities)("flags %s priority correctly", (priority, tone) => {
    const { container } = renderRow(
      task({ title: "Pay phone bill", priority }),
    );
    const flag = container.querySelector('[data-slot="flag"]');
    if (tone) expect(flag!.getAttribute("data-tone")).toBe(tone);
    else expect(flag).toBeNull();
  });

  it("covers every reminder and repeat combination", () => {
    const reminders: Reminder[] = ["none", "5m", "1d"];
    const repeats: Repeat[] = ["never", "daily", "yearly"];
    for (const reminder of reminders) {
      for (const repeat of repeats) {
        const { container, unmount } = renderRow(
          task({ title: "x", reminder, repeat }),
        );
        const icons = container.querySelectorAll(
          '[data-slot="meta"] svg',
        ).length;
        expect(icons).toBe(
          Number(reminder !== "none") + Number(repeat !== "never"),
        );
        unmount();
      }
    }
  });

  it("starts the meta line with the due date when asked, in red when overdue", () => {
    const { container } = renderRow(
      task({
        title: "Submit HCI reflection",
        project_id: "p-hci",
        due_date: "2026-10-21",
        start_time: "23:59",
        priority: "high",
      }),
      {
        showDue: true,
        overdue: true,
      },
    );
    expect(container.querySelector('[data-slot="meta"]')!.textContent).toBe(
      "Wed 21 Oct·HCI·23:59",
    );
    expect(
      container.querySelectorAll('[data-slot="meta"] .text-error'),
    ).toHaveLength(1);
    expect(
      container.querySelector('[data-slot="meta"] .text-error')!.textContent,
    ).toBe("Wed 21 Oct");
    expect(container.querySelector("li")!.className).toContain("is-overdue");
  });

  it("reads no priority when the API sends priority: null", () => {
    renderRow(task({ title: "Call mum", priority: null }));
    expect(screen.getByRole("link").getAttribute("aria-label")).toBe(
      "Call mum, No project",
    );
  });

  it("has a full accessible name (A11Y-51)", () => {
    renderRow(
      task({
        title: "SQL quiz",
        project_id: "p-sql",
        due_date: "2026-10-26",
        start_time: "09:00",
        priority: "high",
        reminder: "1h",
        repeat: "weekly",
      }),
      { showDue: true },
    );
    expect(screen.getByRole("link").getAttribute("aria-label")).toBe(
      "SQL quiz, Mon 26 Oct, 09:00, SQL Course, High priority, reminder set, repeats weekly",
    );
  });

  it('names the checkbox "Complete …" or "Reopen …" and reports its state (A11Y-40)', async () => {
    const onToggle = vi.fn();
    const t = task({ title: "Plan the week" });
    const { rerender } = renderRow(t, { onToggle });
    const box = screen.getByRole("checkbox", {
      name: "Complete Plan the week",
    });
    expect(box.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith(t);
    rerender(
      <main>
        <ul className="m-0 list-none p-0">
          <TaskRow
            task={{ ...t, done: true }}
            today={TODAY}
            timeFormat="24h"
            onToggle={onToggle}
          />
        </ul>
      </main>,
    );
    expect(
      screen
        .getByRole("checkbox", { name: "Reopen Plan the week" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("opens details through a real link", () => {
    renderRow(task({ title: "Renew gym membership", id: "abc" }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/tasks/abc");
  });

  it("is axe clean in both themes, open and done", async () => {
    render(
      <main>
        <ul className="m-0 list-none p-0">
          <TaskRow
            task={task({
              title: "Draft portfolio case study",
              project_id: "p-port",
              start_time: "10:00",
              end_time: "12:00",
              due_date: TODAY,
            })}
            project={projectById("p-port")}
            today={TODAY}
            timeFormat="24h"
            onToggle={() => {}}
          />
          <TaskRow
            task={task({ title: "Read chapter 4", done: true })}
            today={TODAY}
            timeFormat="12h"
            onToggle={() => {}}
          />
        </ul>
      </main>,
    );
    await expectAxeCleanInBothThemes();
  });
});
