import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Gate 5 (docs/06-testing/test-strategy.md): axe reports no serious or critical violations.
const BLOCKING = new Set(["serious", "critical"]);

export async function expectNoAxeViolations(
  page: Page,
  context: string,
): Promise<void> {
  // Next streams the <title> in after the page body; check the page once it has one
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter((v) =>
    BLOCKING.has(v.impact ?? ""),
  );

  const report = blocking
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  - ${JSON.stringify(n.target)}`).join("\n"),
    )
    .join("\n");

  expect(blocking, `axe violations on "${context}":\n${report}`).toEqual([]);
}
