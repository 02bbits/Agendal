import { describe, expect, it } from "vitest";
import { describeRepeat } from "../../src/ui/domain/repeat";
import type { Repeat } from "../../src/ui/domain/types";

function task(
  repeat: Repeat,
  repeat_rule?: string | null,
  repeat_anchor = "2026-11-02",
) {
  return { repeat, repeat_rule, repeat_anchor, due_date: "2026-11-06" };
}

describe("repeat descriptions belong to the frontend", () => {
  it.each([
    [
      "weekly",
      "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      "weekly on Monday, Wednesday, and Friday, forever",
    ],
    [
      "weekly",
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
      "every 2 weeks on Monday, forever",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYMONTHDAY=15",
      "monthly on day 15 of the month, forever",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYDAY=2MO",
      "monthly on second Monday of the month, forever",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYDAY=-1FR",
      "monthly on last Friday of the month, forever",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYMONTHDAY=-1",
      "monthly on the last day of the month, forever",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYMONTHDAY=1,15",
      "monthly on day 1 and day 15 of the month, forever",
    ],
    ["daily", "FREQ=DAILY;INTERVAL=3;COUNT=5", "every 3 days, 5 times"],
    ["daily", "FREQ=DAILY;COUNT=1", "daily, 1 time"],
    [
      "weekly",
      "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T235959Z",
      "weekly on Monday, through 2026-12-31",
    ],
    [
      "yearly",
      "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29",
      "yearly on day 29 in February (leap years only), forever",
    ],
  ] as const)("formats %s %s", (repeat, rule, expected) => {
    expect(describeRepeat(task(repeat, rule))).toBe(expected);
  });

  it.each([
    [
      "weekly",
      "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      "Mỗi tuần vào thứ Hai, thứ Tư và thứ Sáu, không kết thúc",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYDAY=2MO",
      "Mỗi tháng vào thứ Hai thứ hai trong tháng, không kết thúc",
    ],
    [
      "monthly",
      "FREQ=MONTHLY;BYMONTHDAY=15",
      "Mỗi tháng vào ngày 15 trong tháng, không kết thúc",
    ],
    ["daily", "FREQ=DAILY;INTERVAL=3;COUNT=5", "Mỗi 3 ngày, tổng cộng 5 lần"],
    [
      "daily",
      "FREQ=DAILY;UNTIL=20261231T235959Z",
      "Mỗi ngày, đến hết 31/12/2026",
    ],
  ] as const)("supports Vietnamese %s %s", (repeat, rule, expected) => {
    expect(describeRepeat(task(repeat, rule), "vi")).toBe(expected);
  });

  it("uses the original anchor when an occurrence is moved", () => {
    expect(describeRepeat(task("weekly", "FREQ=WEEKLY"))).toBe(
      "weekly on Monday, forever",
    );
    expect(describeRepeat(task("monthly", "FREQ=MONTHLY", "2026-10-15"))).toBe(
      "monthly on day 15 of the month, forever",
    );
  });

  it("distinguishes legacy month-end clamping from calendar skipping", () => {
    const legacy = task("monthly", null, "2026-01-31");
    legacy.due_date = "2026-02-28";
    expect(describeRepeat(legacy)).toBe(
      "monthly on day 31 of the month (last day in shorter months)",
    );
    expect(describeRepeat({ ...legacy, repeat_rule: "FREQ=MONTHLY" })).toBe(
      "monthly on day 31 of the month (skipping months without this day), forever",
    );
  });

  it("has no description for a nonrepeating task", () => {
    expect(describeRepeat(task("never"))).toBeUndefined();
  });

  it.each([
    "FREQ=WEEKLY;INTERVAL=0",
    "FREQ=WEEKLY;INTERVAL=NaN",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=WEEKLY;BYDAY=2MO",
    "FREQ=WEEKLY;COUNT=2;UNTIL=20261231",
    "FREQ=WEEKLY;UNTIL=20260230",
    "FREQ=WEEKLY;FREQ=DAILY",
    "FREQ=WEEKLY;UNKNOWN=1",
    "FREQ=WEEKLY;WKST=XX",
    "FREQ=WEEKLY;UNTIL=20261231T990000Z",
  ])(
    "shows an unrecognized rule explicitly instead of guessing: %s",
    (rule) => {
      expect(describeRepeat(task("weekly", rule))).toBe(
        "Custom repeat schedule",
      );
    },
  );

  it("orders selected weekdays by the rule's week start and removes duplicates", () => {
    expect(
      describeRepeat(task("weekly", "FREQ=WEEKLY;BYDAY=SU,MO,MO;WKST=MO")),
    ).toBe("weekly on Monday and Sunday, forever");
    expect(
      describeRepeat(task("weekly", "FREQ=WEEKLY;BYDAY=MO,SU;WKST=SU")),
    ).toBe("weekly on Sunday and Monday, forever");
  });
});
