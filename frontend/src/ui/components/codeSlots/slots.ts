/** Keeps a spring's value between 0 and 1 for opacity and scale. */
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Only the digits of what was typed or pasted. */
export const digitsOf = (raw: unknown): string =>
  String(raw ?? "").replace(/\D/g, "");

/** A code as `n` slots, one digit each, empty after the last digit. */
export const toSlots = (raw: unknown, n: number): string[] => {
  const digits = digitsOf(raw).slice(0, n);
  return Array.from({ length: n }, (_, i) => digits[i] ?? "");
};

/** Where typing goes next: the first empty slot, or the last one when all are full. */
export const firstEmptyOf = (slots: string[]): number => {
  const i = slots.indexOf("");
  return i === -1 ? slots.length - 1 : i;
};

export const isFull = (slots: string[]): boolean => slots.every(Boolean);

/** The slots' size, gap, corner and colours as the CSS custom properties code-slots reads. */
export function slotsStyle({
  slotSize,
  height,
  gap,
  radius,
  colors,
}: {
  slotSize: number;
  height: number;
  gap: number;
  radius: number;
  colors: Partial<
    Record<"accent" | "ink" | "slot" | "digit" | "danger", string>
  >;
}): Record<string, string | number> {
  const style: Record<string, string | number> = {
    "--cs-size": `${slotSize}px`,
    "--cs-height": `${height}px`,
    "--cs-gap": `${gap}px`,
    "--cs-radius": `${Math.min(radius, slotSize / 2)}px`,
    "--cs-font": `${Math.round(slotSize * 0.5)}px`,
  };
  for (const [name, color] of Object.entries(colors))
    if (color) style[`--cs-${name}`] = color;
  return style;
}
