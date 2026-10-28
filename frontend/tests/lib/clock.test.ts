// @vitest-environment node
import { FakeClock } from "../support/FakeClock";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SystemClock,
  computeRemindAtUtc,
  formatLocalDate,
  formatLocalTime,
  parseWallClockInTimezone,
} from "../../src/lib/clock";

afterEach(() => vi.useRealTimers());

describe("Clock Service (IM-05 / ADR-006)", () => {
  it("FakeClock initializes with pinned time and formats local dates/times", () => {
    const clock = new FakeClock("2026-10-23T08:12:00+07:00");
    expect(clock.toISOString()).toBe("2026-10-23T01:12:00.000Z");
    expect(clock.today("Asia/Ho_Chi_Minh")).toBe("2026-10-23");
    expect(clock.time("Asia/Ho_Chi_Minh")).toBe("08:12");

    // In UTC, 01:12 on 2026-10-23
    expect(clock.today("UTC")).toBe("2026-10-23");
    expect(clock.time("UTC")).toBe("01:12");

    // In New York (EDT, UTC-4), 21:12 on 2026-10-22
    expect(clock.today("America/New_York")).toBe("2026-10-22");
    expect(clock.time("America/New_York")).toBe("21:12");
  });

  it("FakeClock advances time accurately", () => {
    const clock = new FakeClock("2026-10-23T08:12:00+07:00");

    clock.advanceMinutes(30);
    expect(clock.time("Asia/Ho_Chi_Minh")).toBe("08:42");

    clock.advanceHours(2);
    expect(clock.time("Asia/Ho_Chi_Minh")).toBe("10:42");

    clock.advanceDays(1);
    expect(clock.today("Asia/Ho_Chi_Minh")).toBe("2026-10-24");
    expect(clock.time("Asia/Ho_Chi_Minh")).toBe("10:42");

    clock.advanceSeconds(45);
    expect(clock.now().getSeconds()).toBe(45);
  });

  it("FakeClock allows setting time dynamically", () => {
    const clock = new FakeClock("2026-10-23T08:12:00+07:00");
    clock.setTime("2026-12-31T23:59:00Z");
    expect(clock.today("UTC")).toBe("2026-12-31");
    expect(clock.time("UTC")).toBe("23:59");
  });

  it("parseWallClockInTimezone correctly converts floating wall time to UTC", () => {
    // 09:00 in Asia/Ho_Chi_Minh (UTC+7) -> 02:00 UTC
    const utcDate = parseWallClockInTimezone(
      "2026-10-25",
      "09:00",
      "Asia/Ho_Chi_Minh",
    );
    expect(utcDate.toISOString()).toBe("2026-10-25T02:00:00.000Z");

    // Verify roundtrip
    expect(formatLocalDate(utcDate, "Asia/Ho_Chi_Minh")).toBe("2026-10-25");
    expect(formatLocalTime(utcDate, "Asia/Ho_Chi_Minh")).toBe("09:00");
  });

  it("computeRemindAtUtc conforms to ADR-006 rules", () => {
    // 1. With start_time and reminder 30m
    const remindAt = computeRemindAtUtc({
      dueDate: "2026-10-25",
      startTime: "10:00",
      reminder: "30m",
      timezone: "Asia/Ho_Chi_Minh",
    });
    // 10:00 ICT is 03:00 UTC. 30m before is 02:30 UTC.
    expect(remindAt).toBe("2026-10-25T02:30:00.000Z");

    // 2. Without start_time, defaults to 09:00 on due date
    const remindDefault = computeRemindAtUtc({
      dueDate: "2026-10-25",
      reminder: "1h",
      timezone: "Asia/Ho_Chi_Minh",
    });
    // 09:00 ICT is 02:00 UTC. 1h before is 01:00 UTC.
    expect(remindDefault).toBe("2026-10-25T01:00:00.000Z");

    // 3. Reminder 'none' returns null
    expect(
      computeRemindAtUtc({
        dueDate: "2026-10-25",
        startTime: "10:00",
        reminder: "none",
        timezone: "Asia/Ho_Chi_Minh",
      }),
    ).toBeNull();

    // 4. Reminder 1d
    const remind1d = computeRemindAtUtc({
      dueDate: "2026-10-25",
      startTime: "09:00",
      reminder: "1d",
      timezone: "Asia/Ho_Chi_Minh",
    });
    // 09:00 ICT on Oct 25 is 02:00 UTC on Oct 25. 1 day before is 02:00 UTC on Oct 24.
    expect(remind1d).toBe("2026-10-24T02:00:00.000Z");
  });

  it("SystemClock satisfies Clock interface contract", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T01:12:00Z"));
    const clock = new SystemClock();
    expect(clock.toISOString()).toBe("2026-10-23T01:12:00.000Z");
    expect(clock.nowMs()).toBe(Date.parse("2026-10-23T01:12:00Z"));
    expect(clock.today("UTC")).toBe("2026-10-23");
    expect(clock.time("Asia/Ho_Chi_Minh")).toBe("08:12");
  });

  it.each([
    ["2026-03-08", "02:30", "America/New_York", "2026-03-08T07:00:00.000Z"],
    ["2026-11-01", "01:30", "America/New_York", "2026-11-01T05:30:00.000Z"],
    ["2026-10-25", "02:30", "Europe/Berlin", "2026-10-25T00:30:00.000Z"],
    ["2026-10-04", "02:15", "Australia/Lord_Howe", "2026-10-03T15:30:00.000Z"],
    ["2026-10-24", "00:00", "Asia/Ho_Chi_Minh", "2026-10-23T17:00:00.000Z"],
  ])("resolves %s %s in %s using ADR-006", (date, time, zone, expected) => {
    expect(parseWallClockInTimezone(date, time, zone).toISOString()).toBe(
      expected,
    );
  });

  it.each([
    ["2026-02-30", "09:00"],
    ["2026-10-25", "24:00"],
    ["2026-10-25", "09:60"],
    ["invalid", "09:00"],
  ])("rejects invalid floating values %s %s", (date, time) => {
    expect(() => parseWallClockInTimezone(date, time, "UTC")).toThrow(
      RangeError,
    );
  });

  it("subtracts reminder duration in UTC across a DST transition", () => {
    expect(
      computeRemindAtUtc({
        dueDate: "2026-03-08",
        startTime: "03:30",
        reminder: "1h",
        timezone: "America/New_York",
      }),
    ).toBe("2026-03-08T06:30:00.000Z");
  });
});
