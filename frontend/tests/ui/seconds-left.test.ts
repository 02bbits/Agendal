import { renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSecondsLeft } from "../../src/ui/features/auth/useSecondsLeft";

afterEach(() => vi.useRealTimers());

it("counts down from the first render with a new deadline, never 0 in between", () => {
  vi.useFakeTimers({ now: new Date("2026-10-30T09:00:00Z") });
  const rendered: number[] = [];
  const { rerender } = renderHook(
    ({ until }: { until: number | null }) => {
      const left = useSecondsLeft(until);
      rendered.push(left);
      return left;
    },
    { initialProps: { until: null as number | null } },
  );

  rendered.length = 0;
  rerender({ until: Date.now() + 45_000 });
  // A 0 here showed Resend enabled, or "you can sign in again", for one frame
  expect(rendered).not.toContain(0);
  expect(rendered.at(-1)).toBe(45);
});
