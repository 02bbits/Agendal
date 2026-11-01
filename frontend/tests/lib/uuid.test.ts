import { describe, expect, it } from "vitest";
import { uuidv7 } from "@/lib/uuid";

describe("uuidv7 (RFC 9562)", () => {
  it("generates a valid UUID matching the backend's uuid regex rule", () => {
    const id = uuidv7(new Date("2026-10-23T12:00:00Z"));
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it("sets version nibble 7 (4 bits at byte 6)", () => {
    for (let i = 0; i < 20; i++) {
      const id = uuidv7(new Date());
      expect(id.charAt(14)).toBe("7");
    }
  });

  it("sets variant bits 10 (2 bits at byte 8, hex 8, 9, a, or b)", () => {
    for (let i = 0; i < 20; i++) {
      const id = uuidv7(new Date());
      expect(["8", "9", "a", "b"]).toContain(id.charAt(19).toLowerCase());
    }
  });

  it("is increasing for increasing times", () => {
    const t1 = new Date("2026-10-23T10:00:00.000Z");
    const t2 = new Date("2026-10-23T10:00:01.000Z");
    const t3 = new Date("2026-10-24T00:00:00.000Z");

    const id1 = uuidv7(t1);
    const id2 = uuidv7(t2);
    const id3 = uuidv7(t3);

    expect(id1 < id2).toBe(true);
    expect(id2 < id3).toBe(true);
  });
});
