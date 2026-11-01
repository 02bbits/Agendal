// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCatalog } from "../../scripts/gen-copy.mjs";
import { catalog } from "../../src/ui/copy/catalog";
import { pending } from "../../src/ui/copy/pending";
import { isCopyKey, t, tc } from "../../src/ui/copy";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("copy catalog", () => {
  it("matches docs/01-product/copy-catalog.md (run npm run gen:copy after editing the doc)", () => {
    expect(Object.entries(catalog)).toEqual(
      buildCatalog(read("../../../docs/01-product/copy-catalog.md")),
    );
  });

  it("keeps pending keys out of the catalog once they land there", () => {
    const duplicates = Object.keys(pending).filter((key) => key in catalog);
    expect(duplicates).toEqual([]);
  });

  it("fills placeholders", () => {
    expect(t("task.completed", { title: "Read chapter 4" })).toBe(
      "Completed “Read chapter 4”",
    );
    expect(t("list.encourage_progress", { done: 2, left: 4 })).toBe(
      "2 down, 4 to go!",
    );
  });

  it("picks _one and _other forms (UX-33)", () => {
    expect(tc("project.delete_body", 1)).toBe(
      "It has 1 task. What should happen to it?",
    );
    expect(tc("project.delete_body", 3)).toBe(
      "It has 3 tasks. What should happen to them?",
    );
  });

  it("identifies valid copy keys with isCopyKey", () => {
    expect(isCopyKey("task.completed")).toBe(true);
    expect(isCopyKey("error.save_failed")).toBe(true);
    expect(isCopyKey("not.a.real.key")).toBe(false);
    expect(isCopyKey("toString")).toBe(false);
  });
});
