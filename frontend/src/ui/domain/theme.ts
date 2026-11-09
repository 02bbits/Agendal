export interface ThemePalette {
  id: string;
  name: string;
  color: string;
}

export const THEME_PALETTES: Record<string, ThemePalette> = {
  agendal: { id: "agendal", name: "Agendal", color: "#db4c3f" },
  moonstone: { id: "moonstone", name: "Moonstone", color: "#4a7298" },
  tangerine: { id: "tangerine", name: "Tangerine", color: "#ff7043" },
  kale: { id: "kale", name: "Kale", color: "#299764" },
  blueberry: { id: "blueberry", name: "Blueberry", color: "#14aaf5" },
  lavender: { id: "lavender", name: "Lavender", color: "#8c52ff" },
  raspberry: { id: "raspberry", name: "Raspberry", color: "#e040fb" },
};

export const ALL_THEME_PALETTES: readonly ThemePalette[] =
  Object.values(THEME_PALETTES);

export function applyThemePalette(paletteId: string): void {
  if (typeof document === "undefined") return;
  const item = THEME_PALETTES[paletteId];
  if (!item) return;
  document.documentElement.style.setProperty("--color-primary", item.color);
  document.documentElement.style.setProperty(
    "--color-primary-tint",
    `${item.color}22`,
  );
  try {
    localStorage.setItem("agendal.theme_palette", paletteId);
  } catch {}
}
