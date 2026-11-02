import { describe, expect, it } from "vitest";
import { placePopover } from "../../src/ui/components/popoverPosition";

const rect = (left: number, top: number, width = 80, height = 28) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
});

describe("placePopover", () => {
  it("opens under the trigger, aligned to its left edge", () => {
    expect(placePopover(rect(100, 100), 200, 150, 1280, 800, "left")).toEqual({
      top: 134,
      left: 100,
      minWidth: 80,
    });
  });

  it("keeps a popover for a trigger at the right edge inside the window", () => {
    const p = placePopover(rect(1500, 400), 308, 340, 1600, 900, "left");
    expect(p.left).toBe(1600 - 8 - 308);
    expect(p.left + 308).toBeLessThanOrEqual(1600 - 8);
  });

  it("aligns to the trigger's right edge when asked", () => {
    const p = placePopover(rect(1000, 100), 200, 150, 1600, 900, "right");
    expect(p.left).toBe(1080 - 200);
  });

  it("opens above the trigger when there is no room below", () => {
    const p = placePopover(rect(100, 700), 200, 300, 1280, 800, "left");
    expect(p.top).toBe(700 - 6 - 300);
  });

  it("stays inside a window too short for either side", () => {
    const p = placePopover(rect(100, 150), 200, 500, 1280, 560, "left");
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + 500).toBeLessThanOrEqual(560 - 8);
  });

  it("never starts left of the window margin", () => {
    const p = placePopover(rect(4, 100), 300, 150, 1280, 800, "right");
    expect(p.left).toBe(8);
  });
});
