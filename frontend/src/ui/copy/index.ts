import { catalog } from "./catalog";
import { pending } from "./pending";

const strings = { ...pending, ...catalog } as const;

export type CopyKey = keyof typeof strings;
export type CopyVars = Record<string, string | number>;

/** Base key of a counted pair: `list.section_count` for `list.section_count_one/_other`. */
export type CountKey = {
  [K in CopyKey]: K extends `${infer Base}_one`
    ? `${Base}_other` extends CopyKey
      ? Base
      : never
    : never;
}[CopyKey];

function fill(text: string, vars: CopyVars = {}): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Looks up a copy-catalog string and fills its {placeholders}. */
export function t(key: CopyKey, vars?: CopyVars): string {
  return fill(strings[key], vars);
}

/** Counted strings: `_one` for 1, `_other` otherwise (UX-33). `{count}` is filled in. */
export function tc(key: CountKey, count: number, vars: CopyVars = {}): string {
  const form = (count === 1 ? `${key}_one` : `${key}_other`) as CopyKey;
  return fill(strings[form], { count, ...vars });
}

/** Curly quotes around task and project names, as the voice guide asks. */
export function quoted(name: string): string {
  return `“${name}”`;
}
