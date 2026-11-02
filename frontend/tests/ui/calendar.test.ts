import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatMonthYear,
  getWeekdayLabels,
  shiftMonth,
} from "../../src/ui/components/calendar";

describe("calendar pure functions", () => {
  it("builds month grid for Oct 2026 starting Monday", () => {
    const grid = buildMonthGrid(
      "2026-10-01",
      "mon",
      "2026-10-23",
      "2026-10-15",
    );
    expect(grid).toHaveLength(5);

    // Week 1 starts Mon 2026-09-28
    const firstWeek = grid[0]!;
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek[0]?.date).toBe("2026-09-28");
    expect(firstWeek[0]?.dayNumber).toBe(28);
    expect(firstWeek[0]?.isCurrentMonth).toBe(false);

    // Oct 1 is Thursday (index 3 in mon-start week)
    expect(firstWeek[3]?.date).toBe("2026-10-01");
    expect(firstWeek[3]?.dayNumber).toBe(1);
    expect(firstWeek[3]?.isCurrentMonth).toBe(true);

    // Week 4 contains today (2026-10-23, Friday -> index 4)
    const todayCell = grid.flat().find((c) => c.date === "2026-10-23");
    expect(todayCell?.isToday).toBe(true);
    expect(todayCell?.isSelected).toBe(false);

    // Selected date is 2026-10-15
    const selectedCell = grid.flat().find((c) => c.date === "2026-10-15");
    expect(selectedCell?.isSelected).toBe(true);

    // Week 5 ends on Sun 2026-11-01
    const lastWeek = grid[4]!;
    expect(lastWeek[5]?.date).toBe("2026-10-31");
    expect(lastWeek[5]?.isCurrentMonth).toBe(true);
    expect(lastWeek[6]?.date).toBe("2026-11-01");
    expect(lastWeek[6]?.isCurrentMonth).toBe(false);
  });

  it("builds month grid for Oct 2026 starting Sunday", () => {
    const grid = buildMonthGrid("2026-10-01", "sun", "2026-10-23");
    expect(grid).toHaveLength(5);

    // Week 1 starts Sun 2026-09-27
    const firstWeek = grid[0]!;
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek[0]?.date).toBe("2026-09-27");
    expect(firstWeek[0]?.isCurrentMonth).toBe(false);

    // Oct 1 is Thursday (index 4 in sun-start week)
    expect(firstWeek[4]?.date).toBe("2026-10-01");
    expect(firstWeek[4]?.dayNumber).toBe(1);
    expect(firstWeek[4]?.isCurrentMonth).toBe(true);

    // Oct 31 is Saturday (index 6 in last week)
    const lastWeek = grid[4]!;
    expect(lastWeek[6]?.date).toBe("2026-10-31");
    expect(lastWeek[6]?.dayNumber).toBe(31);
    expect(lastWeek[6]?.isCurrentMonth).toBe(true);
  });

  it("provides short weekday labels for mon and sun starts", () => {
    expect(getWeekdayLabels("mon")).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(getWeekdayLabels("sun")).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });

  it("formats month and year in en-GB long format", () => {
    expect(formatMonthYear("2026-10-23")).toBe("October 2026");
    expect(formatMonthYear("2027-01-01")).toBe("January 2027");
  });

  it("shifts date and month accurately", () => {
    expect(shiftMonth("2026-10-23", -1)).toBe("2026-09-23");
    expect(shiftMonth("2026-10-23", 1)).toBe("2026-11-23");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-15");
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-15");
    // Clamping on shorter months (Oct 31 -> Sep 30)
    expect(shiftMonth("2026-10-31", -1)).toBe("2026-09-30");
  });
});
