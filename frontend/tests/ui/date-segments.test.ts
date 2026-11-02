import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  display,
  fromIso,
  isLeapYear,
  pad,
  step,
  toIso,
  typeDigit,
} from "../../src/ui/components/dateSegments";

describe("dateSegments", () => {
  describe("fromIso", () => {
    it("parses valid ISO string", () => {
      expect(fromIso("2026-03-04")).toEqual({
        day: "04",
        month: "03",
        year: "2026",
      });
    });

    it("returns empty segments for null or invalid strings", () => {
      expect(fromIso(null)).toEqual({ day: "", month: "", year: "" });
      expect(fromIso("")).toEqual({ day: "", month: "", year: "" });
      expect(fromIso("invalid")).toEqual({ day: "", month: "", year: "" });
    });
  });

  describe("toIso and leap years", () => {
    it("handles leap year detection correctly", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
    });

    it("returns days in month accurately", () => {
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2024, 2)).toBe(29);
      expect(daysInMonth(2026, 4)).toBe(30);
      expect(daysInMonth(2026, 12)).toBe(31);
    });

    it("converts valid segments to ISO string", () => {
      expect(
        toIso({
          day: "04",
          month: "03",
          year: "2026",
        }),
      ).toBe("2026-03-04");
      expect(
        toIso({
          day: "29",
          month: "02",
          year: "2024",
        }),
      ).toBe("2024-02-29");
    });

    it("returns null for incomplete or invalid dates", () => {
      expect(toIso({ day: "4", month: "03", year: "2026" })).toBeNull();
      expect(toIso({ day: "04", month: "3", year: "2026" })).toBeNull();
      expect(toIso({ day: "04", month: "03", year: "26" })).toBeNull();
      expect(toIso({ day: "31", month: "02", year: "2026" })).toBeNull();
      expect(toIso({ day: "29", month: "02", year: "2026" })).toBeNull();
      expect(toIso({ day: "31", month: "04", year: "2026" })).toBeNull();
      expect(toIso({ day: "00", month: "01", year: "2026" })).toBeNull();
      expect(toIso({ day: "01", month: "13", year: "2026" })).toBeNull();
    });
  });

  describe("typeDigit", () => {
    it("handles day typing and auto-advance", () => {
      expect(typeDigit("day", "", "3")).toEqual({
        value: "3",
        advance: false,
      });
      expect(typeDigit("day", "3", "1")).toEqual({
        value: "31",
        advance: true,
      });
      expect(typeDigit("day", "", "4")).toEqual({
        value: "04",
        advance: true,
      });
      expect(typeDigit("day", "", "9")).toEqual({
        value: "09",
        advance: true,
      });
      // full value restarts with typed digit
      expect(typeDigit("day", "31", "5")).toEqual({
        value: "05",
        advance: true,
      });
      expect(typeDigit("day", "31", "2")).toEqual({
        value: "2",
        advance: false,
      });
    });

    it("handles month typing and auto-advance", () => {
      expect(typeDigit("month", "", "1")).toEqual({
        value: "1",
        advance: false,
      });
      expect(typeDigit("month", "1", "2")).toEqual({
        value: "12",
        advance: true,
      });
      expect(typeDigit("month", "", "2")).toEqual({
        value: "02",
        advance: true,
      });
      expect(typeDigit("month", "", "9")).toEqual({
        value: "09",
        advance: true,
      });
      expect(typeDigit("month", "12", "0")).toEqual({
        value: "0",
        advance: false,
      });
    });

    it("handles year typing up to 4 digits", () => {
      expect(typeDigit("year", "", "2")).toEqual({
        value: "2",
        advance: false,
      });
      expect(typeDigit("year", "2", "1")).toEqual({
        value: "21",
        advance: false,
      });
      expect(typeDigit("year", "21", "9")).toEqual({
        value: "219",
        advance: false,
      });
      expect(typeDigit("year", "219", "0")).toEqual({
        value: "2190",
        advance: true,
      });
      expect(typeDigit("year", "2190", "2")).toEqual({
        value: "2",
        advance: false,
      });
    });

    it("ignores non-digit inputs", () => {
      expect(typeDigit("day", "1", "a")).toEqual({
        value: "1",
        advance: false,
      });
    });
  });

  describe("pad", () => {
    it("pads single digit day and month", () => {
      expect(pad("day", "3")).toBe("03");
      expect(pad("month", "9")).toBe("09");
      expect(pad("day", "31")).toBe("31");
      expect(pad("day", "")).toBe("");
    });

    it("leaves year unchanged", () => {
      expect(pad("year", "2")).toBe("2");
      expect(pad("year", "21")).toBe("21");
      expect(pad("year", "2026")).toBe("2026");
    });
  });

  describe("step", () => {
    it("steps day with wrapping (1-31)", () => {
      expect(step("day", "15", 1)).toBe("16");
      expect(step("day", "31", 1)).toBe("01");
      expect(step("day", "01", -1)).toBe("31");
    });

    it("steps month with wrapping (1-12)", () => {
      expect(step("month", "11", 1)).toBe("12");
      expect(step("month", "12", 1)).toBe("01");
      expect(step("month", "01", -1)).toBe("12");
    });

    it("steps year with wrapping (1900-2100)", () => {
      expect(step("year", "2026", 1)).toBe("2027");
      expect(step("year", "2100", 1)).toBe("1900");
      expect(step("year", "1900", -1)).toBe("2100");
    });

    it("starts from today's part when value is empty", () => {
      expect(step("day", "", 1, "2026-10-23")).toBe("24");
      expect(step("day", "", -1, "2026-10-23")).toBe("22");
      expect(step("month", "", 1, "2026-10-23")).toBe("11");
      expect(step("year", "", 1, "2026-10-23")).toBe("2027");
    });
  });

  describe("display", () => {
    it("returns placeholder key when empty", () => {
      expect(display("day", "")).toEqual({
        text: "",
        placeholder: "dd",
        placeholderKey: "date.placeholder_day",
      });
      expect(display("month", "")).toEqual({
        text: "",
        placeholder: "mm",
        placeholderKey: "date.placeholder_month",
      });
      expect(display("year", "")).toEqual({
        text: "",
        placeholder: "yyyy",
        placeholderKey: "date.placeholder_year",
      });
    });

    it("returns typed value and remaining placeholder for partial year", () => {
      expect(display("year", "2")).toEqual({
        text: "2",
        placeholder: "yyy",
      });
      expect(display("year", "21")).toEqual({
        text: "21",
        placeholder: "yy",
      });
      expect(display("year", "219")).toEqual({
        text: "219",
        placeholder: "y",
      });
      expect(display("year", "2026")).toEqual({
        text: "2026",
        placeholder: "",
      });
    });

    it("returns value and empty placeholder for day and month", () => {
      expect(display("day", "03")).toEqual({
        text: "03",
        placeholder: "",
      });
      expect(display("month", "11")).toEqual({
        text: "11",
        placeholder: "",
      });
    });
  });
});
