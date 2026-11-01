import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headerDate } from "@/app/headerDate";
import { setTimeZone } from "@/lib/clock";

describe("Inbox date overline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T01:12:00Z"));
    setTimeZone("America/Los_Angeles");
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeZone();
  });

  it("writes the date in the device zone", () => {
    expect(headerDate()).toBe("Thursday, 22 October");
    expect(headerDate("Asia/Ho_Chi_Minh")).toBe("Friday, 23 October");
  });
});
