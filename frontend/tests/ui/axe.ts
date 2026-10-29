import axe from "axe-core";
import { expect } from "vitest";

export const THEMES = ["agendal-light", "agendal-dark"] as const;

/**
 * Runs axe on the rendered DOM with data-theme set to each theme.
 * jsdom has no layout, so axe's color-contrast rule can't run here;
 * contrast is checked from the tokens in tokens.test.ts instead.
 */
export async function expectAxeCleanInBothThemes(
  root: Element = document.body,
): Promise<void> {
  for (const theme of THEMES) {
    document.documentElement.setAttribute("data-theme", theme);
    const result = await axe.run(root, {
      rules: { "color-contrast": { enabled: false } },
    });
    const summary = result.violations.map(
      (v) => `${theme}: ${v.id} — ${v.help}`,
    );
    expect(summary).toEqual([]);
  }
}
