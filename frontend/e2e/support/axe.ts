import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Gate 5 (docs/06-testing/test-strategy.md): axe reports no serious or critical violations.
const BLOCKING = new Set(["serious", "critical"]);

/** A violation reported but not fixed here (another owner's screen), named in the test report. */
export interface KnownIssue {
  rule: string;
  /** The nodes it applies to: their HTML contains this. */
  htmlContains: string;
  reason: string;
}

export async function expectNoAxeViolations(
  page: Page,
  context: string,
  knownIssues: KnownIssue[] = [],
): Promise<void> {
  // Next streams the <title> in after the page body; check the page once it has one
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const isKnown = (rule: string, html: string) =>
    knownIssues.some(
      (known) => known.rule === rule && html.includes(known.htmlContains),
    );
  for (const known of knownIssues)
    test.info().annotations.push({
      type: "known a11y issue",
      description: `${context}: ${known.rule}, ${known.reason}`,
    });
  const blocking = results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !isKnown(v.id, n.html)),
    }))
    .filter((v) => v.nodes.length > 0);

  const report = blocking
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  - ${JSON.stringify(n.target)}`).join("\n"),
    )
    .join("\n");

  expect(blocking, `axe violations on "${context}":\n${report}`).toEqual([]);
}
