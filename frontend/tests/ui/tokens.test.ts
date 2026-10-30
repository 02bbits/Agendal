// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROJECT_COLORS } from "../../src/ui";

// NF-1: text ≥ 4.5:1 and field borders ≥ 3:1 against bg, in both daisyUI themes.
const css = readFileSync(
  fileURLToPath(new URL("../../src/ui/theme.css", import.meta.url)),
  "utf8",
)
  .split(String.fromCharCode(13))
  .join("");

/** Custom properties declared in a CSS block, comments removed. */
function vars(body: string): Record<string, string> {
  return Object.fromEntries(
    [
      ...body
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .matchAll(/--([\w-]+):\s*([^;]+);/g),
    ].map(([, name, value]) => [name!, value!.trim()]),
  );
}

/** The `@plugin "daisyui/theme"` block with this name, keyed by theme-guide token names. */
function theme(name: string): Record<string, string> {
  const block = [...css.matchAll(/@plugin "daisyui\/theme" \{([^{}]*)\}/g)]
    .map(([, body]) => body!)
    .find((body) => body.includes(`name: "${name}"`));
  if (!block) throw new Error(`missing theme ${name}`);
  const v = vars(block);
  return {
    bg: v["color-base-100"]!,
    fill: v["color-base-200"]!,
    separator: v["color-base-300"]!,
    ink: v["color-base-content"]!,
    accent: v["color-primary"]!,
    "on-accent": v["color-primary-content"]!,
    danger: v["color-error"]!,
    success: v["color-success"]!,
    warning: v["color-warning"]!,
    neutral: v["color-neutral"]!,
    "neutral-content": v["color-neutral-content"]!,
    surface: v["ag-surface"]!,
    "control-border": v["ag-control-border"]!,
    "ink-secondary": v["ag-ink-secondary"]!,
    "ink-tertiary": v["ag-ink-tertiary"]!,
    "danger-tint": v["ag-danger-tint"]!,
  };
}

function luminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  "agendal-light": theme("agendal-light"),
  "agendal-dark": theme("agendal-dark"),
};

describe("Paper & ink daisyUI themes", () => {
  it("matches the theme guide values", () => {
    expect(themes["agendal-light"]).toMatchObject({
      bg: "#f6f5f1",
      ink: "#1b1a17",
      accent: "#2f5bd3",
      danger: "#b42318",
    });
    expect(themes["agendal-dark"]).toMatchObject({
      bg: "#121211",
      ink: "#f2f0ea",
      accent: "#8fadff",
      danger: "#ff8a7f",
    });
  });

  it("defines every token in both themes", () => {
    for (const t of Object.values(themes)) {
      for (const [token, value] of Object.entries(t))
        expect(value, token).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("follows the system setting when no data-theme is set", () => {
    expect(css).toMatch(
      /name: "agendal-light";\s*default: true;\s*prefersdark: false;/,
    );
    expect(css).toMatch(
      /name: "agendal-dark";\s*default: false;\s*prefersdark: true;/,
    );
  });

  for (const [name, t] of Object.entries(themes)) {
    describe(name, () => {
      it.each([
        "ink",
        "ink-secondary",
        "ink-tertiary",
        "accent",
        "danger",
        "success",
        "warning",
      ] as const)("%s text reaches 4.5:1 on bg", (token) => {
        expect(contrast(t[token], t.bg)).toBeGreaterThanOrEqual(4.5);
      });

      it.each(["ink", "ink-secondary", "ink-tertiary"] as const)(
        "%s text reaches 4.5:1 on surface",
        (token) => {
          expect(contrast(t[token], t.surface)).toBeGreaterThanOrEqual(4.5);
        },
      );

      it("control-border reaches 3:1 on bg", () => {
        expect(contrast(t["control-border"], t.bg)).toBeGreaterThanOrEqual(3);
      });

      it("on-accent text reaches 4.5:1 on the primary button", () => {
        expect(contrast(t["on-accent"], t.accent)).toBeGreaterThanOrEqual(4.5);
      });

      it("danger text reaches 4.5:1 on danger-tint (destructive button)", () => {
        expect(contrast(t.danger, t["danger-tint"])).toBeGreaterThanOrEqual(
          4.5,
        );
      });

      it("selected chips and toasts (neutral) reach 4.5:1", () => {
        expect(
          contrast(t["neutral-content"], t.neutral),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it("ink text reaches 4.5:1 on fill (secondary button, chip)", () => {
        expect(contrast(t.ink, t.fill)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it("has a Tailwind colour for each of the 8 project colours", () => {
    expect(PROJECT_COLORS).toHaveLength(8);
    for (const color of PROJECT_COLORS) {
      expect(css).toMatch(
        new RegExp(`--color-project-${color}: #[0-9a-f]{6};`),
      );
    }
  });
});

describe("theme choice (AP-3, T-AP-20)", () => {
  /** The plain options of a theme block (name, prefersdark, root…), as daisyUI's plugin reads them. */
  function options(name: string): Record<string, string | boolean> {
    const block = [...css.matchAll(/@plugin "daisyui\/theme" \{([^{}]*)\}/g)]
      .map(([, body]) => body!.replace(/\/\*[\s\S]*?\*\//g, ""))
      .find((body) => body.includes(`name: "${name}"`))!;
    return Object.fromEntries(
      [...block.matchAll(/^\s*([a-z][\w-]*):\s*([^;]+);/gm)].map(
        ([, key, value]) => {
          const v = value!.trim();
          return [
            key!,
            v === "true"
              ? true
              : v === "false"
                ? false
                : v.replace(/^"|"$/g, ""),
          ];
        },
      ),
    );
  }

  it("the system dark mode never overrides a theme the user picked", async () => {
    // daisyUI ships this plugin without types
    const pluginPath = "daisyui/theme/index.js";
    const { default: theme } = (await import(
      /* @vite-ignore */ pluginPath
    )) as {
      default: (options: object) => {
        handler: (api: { addBase: (rule: never) => void }) => void;
      };
    };
    const added: Record<string, Record<string, unknown>>[] = [];
    theme(options("agendal-dark")).handler({
      addBase: (rule: never) => added.push(rule),
    });
    const systemDark = added.find(
      (rule) => "@media (prefers-color-scheme: dark)" in rule,
    )!;

    // With a bare ":root" this rule outranks [data-theme="agendal-light"], so Light can't be picked
    expect(
      Object.keys(systemDark["@media (prefers-color-scheme: dark)"]!),
    ).toEqual([":root:not([data-theme])"]);
  });
});
