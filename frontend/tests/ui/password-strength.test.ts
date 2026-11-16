// @vitest-environment node
import { describe, expect, it } from "vitest";
import { passwordStrength } from "../../src/ui/domain/passwordStrength";

describe("passwordStrength", () => {
  it("scores 0 when under 8 characters", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("a")).toBe(0);
    expect(passwordStrength("Ab1!")).toBe(0);
    expect(passwordStrength("Ab1!xyz")).toBe(0); // 7 characters
  });

  it("scores 1 for 8 characters with 1 or 2 character classes", () => {
    expect(passwordStrength("abcdefgh")).toBe(1); // 8 chars, 1 class (lower)
    expect(passwordStrength("abcdefg1")).toBe(1); // 8 chars, 2 classes (lower, digit)
  });

  it("adds +1 when 3 or more classes are present", () => {
    expect(passwordStrength("Abcdefg1")).toBe(2); // 8 chars (+1), 3 classes (+1)
    expect(passwordStrength("Abcdef1!")).toBe(2); // 8 chars (+1), 4 classes (+1)
  });

  it("scores at length boundaries: 11, 12, 15, 16 characters", () => {
    // 11 chars
    expect(passwordStrength("abcdefghijk")).toBe(1); // 11 chars, 1 class -> 1
    expect(passwordStrength("Abcdefghij1")).toBe(2); // 11 chars, 3 classes -> 2

    // 12 chars (+1 for length 12+)
    expect(passwordStrength("abcdefghijkl")).toBe(2); // 12 chars, 1 class -> 2
    expect(passwordStrength("Abcdefghijk1")).toBe(3); // 12 chars (+2), 3 classes (+1) -> 3

    // 15 chars
    expect(passwordStrength("abcdefghijklmno")).toBe(2); // 15 chars, 1 class -> 2
    expect(passwordStrength("Abcdefghijklmn1")).toBe(3); // 15 chars, 3 classes -> 3

    // 16 chars (+1 for length 16+)
    expect(passwordStrength("abcdefghijklmnop")).toBe(3); // 16 chars, 1 class -> 3
    expect(passwordStrength("Abcdefghijklmno1")).toBe(4); // 16 chars (+3), 3 classes (+1) -> 4
  });

  it("counts an emoji as 1 character and as a symbol class", () => {
    // 7 ASCII + 1 emoji = 8 characters
    // "abcdefg" (lower) + "🔒" (symbol) = 2 classes, 8 chars -> 1
    expect(passwordStrength("abcdefg🔒")).toBe(1);

    // "Abcdefg" (lower, upper) + "🔒" (symbol) = 3 classes, 8 chars -> 2
    expect(passwordStrength("Abcdefg🔒")).toBe(2);

    // 7 characters with emoji: "Abcdef🔒" = 7 characters -> 0
    expect(passwordStrength("Abcdef🔒")).toBe(0);
  });
});
