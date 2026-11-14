import { describe, expect, it } from "vitest";
import {
  KeyboardOnlyFilter,
  keyBetween,
  telexKeys,
} from "../../src/ui/features/auth/keyboardOnly";

/** Plays what Vietnamese typing sends: each step is the field's next value, a few ms apart. */
function play(steps: string[]): string {
  const filter = new KeyboardOnlyFilter();
  let value = "";
  let at = 1000;
  for (const step of steps) {
    value = filter.change(value, step, (at += 200)).value;
  }
  return value;
}

/** Simulates Unikey: type a key, or delete n letters and type the accented ones. */
type Step = { type: string } | { replace: number; with: string };
function unikey(steps: Step[]): string {
  const filter = new KeyboardOnlyFilter();
  let value = "";
  let at = 1000;
  for (const step of steps) {
    if ("type" in step) {
      value = filter.change(value, value + step.type, (at += 120)).value;
      continue;
    }
    for (let i = 0; i < step.replace; i++) {
      value = filter.change(
        value,
        [...value].slice(0, -1).join(""),
        (at += 2),
      ).value;
    }
    value = filter.change(value, value + step.with, (at += 2)).value;
  }
  return value;
}

describe("AA §2.10: password fields keep the keys pressed, not Vietnamese typing", () => {
  it.each([
    ["A then A (Â)", [{ type: "A" }, { replace: 1, with: "Â" }], "AA"],
    [
      "a, a, s (ấ)",
      [{ type: "a" }, { replace: 1, with: "â" }, { replace: 1, with: "ấ" }],
      "aas",
    ],
    ["d, d (đ)", [{ type: "d" }, { replace: 1, with: "đ" }], "dd"],
    [
      "h, o, a, s (hoá: the tone moves back)",
      [{ type: "h" }, { type: "o" }, { type: "a" }, { replace: 2, with: "óa" }],
      "hoas",
    ],
    [
      "u, o, w (ươ: a mark on two letters)",
      [{ type: "u" }, { type: "o" }, { replace: 2, with: "ươ" }],
      "uow",
    ],
    [
      "a, a, a (undo back to aa)",
      [{ type: "a" }, { replace: 1, with: "â" }, { replace: 1, with: "aa" }],
      "aaa",
    ],
    [
      "m, a, a, t, j then a digit",
      [
        { type: "m" },
        { type: "a" },
        { replace: 1, with: "â" },
        { type: "t" },
        { replace: 2, with: "ật" },
        { type: "1" },
      ],
      "maatj1",
    ],
  ] as [string, Step[], string][])("%s", (_name, steps, expected) => {
    expect(unikey(steps)).toBe(expected);
  });

  it("a lone W (Telex types ư) stays W, and later marks on it still work", () => {
    expect(unikey([{ type: "ư" }])).toBe("w");
    expect(unikey([{ type: "Ư" }])).toBe("W");
    expect(
      unikey([{ type: "ư" }, { type: "a" }, { replace: 2, with: "ứa" }]),
    ).toBe("was");
  });

  it("keeps plain keys, spaces, symbols and emoji as typed", () => {
    expect(play(["q", "qu", "qu ", "qu !", "qu !👍🏽"])).toBe("qu !👍🏽");
  });

  // Pasted text has no key order: each letter becomes its own keys
  it("turns pasted Vietnamese into its keys and drops other scripts", () => {
    const filter = new KeyboardOnlyFilter();
    expect(filter.change("", "mật", 1000)).toEqual({
      value: "maajt",
      caret: 5,
      dropped: false,
    });
    expect(filter.change("maajt", "maajtパス", 2000)).toMatchObject({
      value: "maajt",
      dropped: true,
    });
    expect(filter.change("maatj", "maatj\t", 3000)).toMatchObject({
      value: "maatj",
      dropped: true,
    });
  });

  it("a real Backspace deletes one key, and an edit in the middle keeps the caret there", () => {
    const filter = new KeyboardOnlyFilter();
    filter.change("", "abc", 1000);
    expect(filter.change("abc", "ab", 2000).value).toBe("ab");
    expect(filter.change("ab", "aéb", 3000)).toEqual({
      value: "aesb",
      caret: 3,
      dropped: false,
    });
  });

  it("follows the form when it clears the field", () => {
    const filter = new KeyboardOnlyFilter();
    filter.change("", "abc", 1000);
    expect(filter.change("", "x", 2000).value).toBe("x");
  });

  it("works out the Telex keys and the key between two shapes", () => {
    expect(telexKeys("Đường")).toBe("DDuwowngf");
    expect(keyBetween("á", "à")).toBe("f");
    expect(keyBetween("uo", "ươ")).toBe("w");
  });
});
