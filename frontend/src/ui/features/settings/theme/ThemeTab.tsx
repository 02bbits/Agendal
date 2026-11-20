import { useState, type MouseEvent, type ReactElement } from "react";
import { cx } from "../../../components/cx";
import { CheckIcon } from "../../../components/icons";
import { Segmented } from "../../../components/Segmented";
import { t } from "../../../copy";
import { ALL_THEME_PALETTES, applyThemePalette } from "../../../domain/theme";
import { runThemeTransition } from "../../../domain/themeTransition";
import { SettingsHeading } from "../SettingsSection";
import type { AccountSettings, ChangeSettings } from "../types";

const DEFAULT_PALETTE = "default";
/** How long a tapped theme card pulses. */
const RIPPLE_MS = 500;

type Palette = (typeof ALL_THEME_PALETTES)[number];

/** The default theme follows the ink colours; the others show their own colour. */
const swatch = (palette: Palette, inkVar: string) =>
  palette.id === DEFAULT_PALETTE ? `var(${inkVar})` : palette.color;

/** Settings > Theme: light, dark or system, and the accent theme. */
export function ThemeTab({
  settings,
  onChange,
}: {
  settings: AccountSettings;
  onChange: ChangeSettings;
}): ReactElement {
  const [ripplingId, setRipplingId] = useState<string | null>(null);
  const currentPalette = settings.palette ?? DEFAULT_PALETTE;

  const choosePalette = (id: string, event: MouseEvent) => {
    // The theme in use again changes nothing: no pulse, no fade
    if (id === currentPalette) return;
    setRipplingId(id);
    setTimeout(
      () => setRipplingId((current) => (current === id ? null : current)),
      RIPPLE_MS,
    );
    runThemeTransition(event, () => {
      applyThemePalette(id);
      onChange({ palette: id });
    });
  };

  return (
    <>
      <section className="space-y-2.5">
        <SettingsHeading className="mb-2.5">
          {t("app.appearance")}
        </SettingsHeading>
        <Segmented
          label={t("app.appearance")}
          value={settings.theme}
          onChange={(theme, event) =>
            runThemeTransition(event, () => onChange({ theme }))
          }
          size="lg"
          options={[
            { value: "light", label: t("app.theme_light") },
            { value: "dark", label: t("app.theme_dark") },
            { value: "system", label: t("app.theme_system") },
          ]}
        />
      </section>

      <section className="space-y-3">
        <SettingsHeading className="mb-3">
          {t("settings.your_themes")}
        </SettingsHeading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {ALL_THEME_PALETTES.map((palette) => {
            const isCurrent = currentPalette === palette.id;
            return (
              <div
                key={palette.id}
                onClick={(event) => choosePalette(palette.id, event)}
                className={cx(
                  "rounded-xl border p-3 bg-surface/40 hover:border-separator transition-all cursor-pointer space-y-2.5",
                  isCurrent
                    ? "border-primary/80 ring-1 ring-primary/40 bg-fill/20"
                    : "border-separator/50 hover:bg-fill/10",
                  ripplingId === palette.id && "animate-pulse-ripple",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-8 rounded-full shadow-xs"
                      style={{
                        backgroundColor: swatch(palette, "--color-ink"),
                      }}
                    />
                    <span className="text-footnote font-semibold text-ink">
                      {palette.name}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="text-primary" aria-hidden="true">
                      <CheckIcon size={15} />
                    </span>
                  )}
                </div>
                {/* Two sample task rows in this theme's colour */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full border"
                      style={{
                        borderColor: swatch(palette, "--color-ink-secondary"),
                      }}
                    />
                    <div className="h-1.5 w-24 rounded-full bg-fill-2" />
                  </div>
                  <div className="pl-5">
                    <div className="h-1.5 w-28 rounded-full bg-fill" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
