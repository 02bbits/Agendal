import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ClockProvider, useClock } from "@/lib/clock/ClockProvider";
import { FakeClock } from "../support/FakeClock";

function CurrentDate() {
  const clock = useClock();
  return <output>{clock.today("Asia/Ho_Chi_Minh")}</output>;
}

it("injects a pinned clock into components and follows local midnight", () => {
  const clock = new FakeClock("2026-10-23T23:59:00+07:00");
  const view = render(
    <ClockProvider clock={clock}>
      <CurrentDate />
    </ClockProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("2026-10-23");

  clock.advanceMinutes(1);
  view.rerender(
    <ClockProvider clock={clock}>
      <CurrentDate />
    </ClockProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("2026-10-24");
});
