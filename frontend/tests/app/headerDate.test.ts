import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headerDate, subscribeHeaderDate } from "@/app/headerDate";
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

  it("notifies subscriber when midnight passes or visibility changes", () => {
    let called = false;
    const unsub = subscribeHeaderDate(() => {
      called = true;
    });

    expect(called).toBe(false);

    // Simulate visibility change
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(called).toBe(true);

    unsub();
  });
});
