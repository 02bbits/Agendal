import { describe, expect, it } from "vitest";
import {
  daysAfter,
  dayHeading,
  dayHeadingShort,
  formatWeekRange,
  isCurrentWeek,
  shiftWeek,
  stripLabel,
  visibleDays,
  weekOf,
} from "../../src/ui/domain/week";

describe("week model pure helpers (Section 2)", () => {
  const today = "2026-11-02"; // Monday

  it("weekOf returns 7 dates aligned to weekStart", () => {
    const monWeek = weekOf(today, "mon");
    expect(monWeek).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);

    const sunWeek = weekOf(today, "sun");
    expect(sunWeek).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
  });

  it("visibleDays hides days before today", () => {
    const sunWeek = weekOf(today, "sun");
    expect(visibleDays(sunWeek, today)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);

    const monWeek = weekOf(today, "mon");
    expect(visibleDays(monWeek, today)).toEqual(monWeek);
  });

  it("daysAfter hides today and days before today", () => {
    const sunWeek = weekOf(today, "sun");
    expect(daysAfter(sunWeek, today)).toEqual([
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);

    const monWeek = weekOf(today, "mon");
    expect(daysAfter(monWeek, today)).toEqual([
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("shiftWeek adds or subtracts weeks", () => {
    expect(shiftWeek(today, 1)).toBe("2026-11-09");
    expect(shiftWeek(today, -1)).toBe("2026-10-26");
  });

  it("isCurrentWeek checks if today is in the week", () => {
    const monWeek = weekOf(today, "mon");
    expect(isCurrentWeek(monWeek, today)).toBe(true);

    const nextWeek = weekOf(shiftWeek(today, 1), "mon");
    expect(isCurrentWeek(nextWeek, today)).toBe(false);
  });

  it("dayHeading formats Today, Tomorrow, and weekday", () => {
    expect(dayHeading("2026-11-02", today)).toBe("2 Nov · Today · Monday");
    expect(dayHeading("2026-11-03", today)).toBe("3 Nov · Tomorrow · Tuesday");
    expect(dayHeading("2026-11-04", today)).toBe("4 Nov · Wednesday");
    expect(dayHeading("2026-11-05", today)).toBe("5 Nov · Thursday");
  });

  it("dayHeadingShort formats short headings for board", () => {
    expect(dayHeadingShort("2026-11-02", today)).toBe("2 Nov · Today");
    expect(dayHeadingShort("2026-11-03", today)).toBe("3 Nov · Tomorrow");
    expect(dayHeadingShort("2026-11-04", today)).toBe("4 Nov · Wednesday");
  });

  it("stripLabel returns short weekday and day number", () => {
    expect(stripLabel("2026-11-02")).toEqual({ weekday: "Mon", day: 2 });
    expect(stripLabel("2026-11-08")).toEqual({ weekday: "Sun", day: 8 });
  });

  it("formatWeekRange formats same month as '2 – 8 Nov' and across months as '30 Nov – 6 Dec'", () => {
    const sameMonthWeek = weekOf("2026-11-02", "mon");
    expect(formatWeekRange(sameMonthWeek)).toBe("2 – 8 Nov");

    const acrossMonthWeek = weekOf("2026-12-01", "mon"); // 30 Nov - 6 Dec
    expect(formatWeekRange(acrossMonthWeek)).toBe("30 Nov – 6 Dec");
  });
});
