import { describe, expect, it } from "vitest";
import { undoExpired } from "../../src/ui/domain/dates";

describe("undoExpired (RV-E2)", () => {
  const processed = "2026-10-01T08:00:00+07:00";

  it("is a timestamp rule: 30 days to the minute, not calendar dates", () => {
    expect(undoExpired(processed, new Date("2026-10-31T07:59:00+07:00"))).toBe(
      false,
    );
    expect(undoExpired(processed, new Date("2026-10-31T08:01:00+07:00"))).toBe(
      true,
    );
  });
});
