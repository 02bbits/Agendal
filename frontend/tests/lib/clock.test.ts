import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { localTime, now, setTimeZone, timeZone, today } from "@/lib/clock";

describe("clock (IM-05)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T01:12:00Z"));
    setTimeZone("America/Los_Angeles");
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeZone();
  });

  it("gives the floating local date and time in the device zone", () => {
    expect(now().toISOString()).toBe("2026-10-23T01:12:00.000Z");
    expect(today()).toBe("2026-10-22");
    expect(localTime()).toBe("18:12");
    expect(today("Asia/Ho_Chi_Minh")).toBe("2026-10-23");
    expect(localTime("Asia/Ho_Chi_Minh")).toBe("08:12");
  });

  it("sends X-Timezone on every API request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await api("/me", { headers: { "X-Test": "1" } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/me");
    expect(new Headers(init.headers).get("X-Timezone")).toBe(timeZone());
    expect(new Headers(init.headers).get("X-Test")).toBe("1");
    vi.unstubAllGlobals();
  });
});
