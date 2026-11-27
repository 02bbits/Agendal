import { describe, expect, it } from "vitest";
import { downsampler } from "../../src/lib/dictation";

describe("downsampler (NC §2.3)", () => {
  it("averages each window down to 16 kHz", () => {
    const down = downsampler(48000);
    expect([...down(new Float32Array([1, 1, 1, 2, 2, 2]))]).toEqual([1, 2]);
  });

  it("carries a window across two slices", () => {
    const down = downsampler(48000);
    expect([...down(new Float32Array([1, 1]))]).toEqual([]);
    expect([...down(new Float32Array([1, 4, 4, 4]))]).toEqual([1, 4]);
  });

  it("keeps the length right at a rate that isn't a multiple of 16 kHz", () => {
    const down = downsampler(44100);
    let total = 0;
    for (let slice = 0; slice < 100; slice++)
      total += down(new Float32Array(4096).fill(0.5)).length;
    expect(total).toBe(Math.floor((100 * 4096 * 16000) / 44100));
  });
});
