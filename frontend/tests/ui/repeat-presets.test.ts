import { describe, expect, it } from "vitest";
import {
  buildRule,
  defaultCustom,
  parseRule,
  presetIdFor,
  repeatPresets,
  type CustomRepeat,
} from "../../src/ui/domain/repeatPresets";

// #154: the Repeat presets come from the date the series starts on
describe("repeatPresets", () => {
  it("builds every preset from Monday 16 Nov 2026 (the third Monday)", () => {
    const presets = repeatPresets("2026-11-16");
    expect(
      presets.map((p) => [p.id, p.value.repeat, p.value.repeat_rule]),
    ).toEqual([
      ["never", "never", null],
      ["daily", "daily", null],
      ["weekdays", "weekly", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
      ["weekly", "weekly", "FREQ=WEEKLY;BYDAY=MO"],
      ["biweekly", "weekly", "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"],
      ["monthly_day", "monthly", "FREQ=MONTHLY;BYMONTHDAY=16"],
      ["monthly_weekday", "monthly", "FREQ=MONTHLY;BYDAY=3MO"],
      ["yearly", "yearly", "FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=16"],
    ]);
    expect(presets.map((p) => p.label)).toEqual([
      "Doesn't repeat",
      "Every day",
      "Every weekday (Mon–Fri)",
      "Every week on Monday",
      "Every 2 weeks on Monday",
      "Every month on the 16th",
      "Every month on the third Monday",
      "Every year on 16 Nov",
    ]);
  });

  it("uses the last weekday of the month when there is no later one (Friday 27 Nov)", () => {
    const monthly = repeatPresets("2026-11-27").find(
      (p) => p.id === "monthly_weekday",
    )!;
    expect(monthly.value.repeat_rule).toBe("FREQ=MONTHLY;BYDAY=-1FR");
    expect(monthly.label).toBe("Every month on the last Friday");
  });

  it("writes 1st, 2nd, 3rd and 11th–13th correctly", () => {
    const label = (date: string) =>
      repeatPresets(date).find((p) => p.id === "monthly_day")!.label;
    expect(label("2026-11-01")).toBe("Every month on the 1st");
    expect(label("2026-11-02")).toBe("Every month on the 2nd");
    expect(label("2026-11-03")).toBe("Every month on the 3rd");
    expect(label("2026-11-11")).toBe("Every month on the 11th");
    expect(label("2026-11-12")).toBe("Every month on the 12th");
    expect(label("2026-11-22")).toBe("Every month on the 22nd");
  });
});

describe("presetIdFor", () => {
  const anchor = "2026-11-16";
  it("finds every preset it builds", () => {
    for (const preset of repeatPresets(anchor)) {
      expect(presetIdFor(preset.value, anchor)).toBe(preset.id);
    }
  });

  it("treats a bare frequency as its preset, and anything else as custom", () => {
    expect(presetIdFor({ repeat: "weekly", repeat_rule: null }, anchor)).toBe(
      "weekly",
    );
    expect(presetIdFor({ repeat: "monthly", repeat_rule: null }, anchor)).toBe(
      "monthly_day",
    );
    expect(
      presetIdFor(
        { repeat: "weekly", repeat_rule: "FREQ=WEEKLY;BYDAY=MO,WE" },
        anchor,
      ),
    ).toBe("custom");
  });
});

describe("buildRule and parseRule", () => {
  const anchor = "2026-11-16";
  const cases: Array<[string, CustomRepeat, string]> = [
    [
      "every 2 weeks on Mon and Wed",
      { ...defaultCustom(anchor), interval: 2, days: ["WE", "MO"] },
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE",
    ],
    [
      "every day, 10 times",
      {
        ...defaultCustom(anchor),
        frequency: "daily",
        end: { kind: "after", count: 10 },
      },
      "FREQ=DAILY;COUNT=10",
    ],
    [
      "every month on the third Monday until 20 Dec",
      {
        ...defaultCustom(anchor),
        frequency: "monthly",
        monthMode: "weekday",
        end: { kind: "on", date: "2026-12-20" },
      },
      "FREQ=MONTHLY;BYDAY=3MO;UNTIL=20261220T235959Z",
    ],
    [
      "every 3 years",
      { ...defaultCustom(anchor), frequency: "yearly", interval: 3 },
      "FREQ=YEARLY;INTERVAL=3;BYMONTH=11;BYMONTHDAY=16",
    ],
  ];

  it.each(cases)("%s", (_name, custom, rule) => {
    const value = buildRule(custom, anchor);
    expect(value).toEqual({ repeat: custom.frequency, repeat_rule: rule });
    const parsed = parseRule(value, anchor);
    expect(buildRule(parsed, anchor)).toEqual(value);
  });

  it("clamps the interval and count to what the server accepts", () => {
    const value = buildRule(
      {
        ...defaultCustom(anchor),
        frequency: "daily",
        interval: 0,
        end: { kind: "after", count: 5000 },
      },
      anchor,
    );
    expect(value.repeat_rule).toBe("FREQ=DAILY;COUNT=1000");
  });
});
