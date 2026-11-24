import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeTab } from "../../src/ui/features/settings/theme/ThemeTab";
import { runThemeTransition } from "../../src/ui/domain/themeTransition";
import { ALL_THEME_PALETTES } from "../../src/ui/domain/theme";
import type { AccountSettings } from "../../src/ui";
import { t } from "../../src/ui/copy";
import { expectAxeCleanInBothThemes } from "./axe";

// IM-55: AP §6 accessibility of the Appearance setting and theme changes
const settings: AccountSettings = {
  theme: "light",
  weekStart: "mon",
  timeFormat: "24h",
  rememberDevice: true,
  palette: ALL_THEME_PALETTES[0]!.id,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Appearance", () => {
  it("A11Y-71: is a radio group, axe-clean in both themes", async () => {
    render(
      <main>
        <ThemeTab settings={settings} onChange={() => {}} />
      </main>,
    );

    const group = screen.getByRole("radiogroup", { name: t("app.appearance") });
    expect(
      [...group.querySelectorAll('[role="radio"]')].map((r) =>
        r.getAttribute("aria-checked"),
      ),
    ).toEqual(["true", "false", "false"]);
    await expectAxeCleanInBothThemes();
  });

  it("A11Y-73: with reduced motion the theme changes without the view transition", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
    }));
    const startViewTransition = vi.fn();
    Object.assign(document, { startViewTransition });
    const apply = vi.fn();

    runThemeTransition(undefined, apply);

    expect(apply).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });
});
