/**
 * Password fields keep only what an English keyboard types, plus emoji (AA §2.10). Vietnamese
 * typing (Unikey, EVKey, Telex) can't be switched off by a page: it deletes the last letters and
 * types the accented one instead ("a" + "a" → "â"). The field undoes that and keeps the keys the
 * person pressed ("aa"), so the password is the same with Vietnamese typing on or off. Anything
 * else (other scripts, a tab) is dropped. The form and the server check the same rule again.
 */

const ALLOWED =
  /^[\x20-\x7E\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{20E3}]$/u;

// Telex keys for each Vietnamese mark: the letter mark repeats the letter or adds "w"
const TONES: Record<string, string> = {
  "́": "s",
  "̀": "f",
  "̉": "r",
  "̃": "x",
  "̣": "j",
};
const SHAPES = new Set(["̂", "̆", "̛"]);

export const isKeyboardChar = (ch: string) => ALLOWED.test(ch);

/** A Latin letter with Vietnamese marks only (â, ấ, ư, đ…): it can be turned back into keys. */
export function isVietnameseChar(ch: string): boolean {
  if (ch === "đ" || ch === "Đ") return true;
  const [base, ...marks] = [...ch.normalize("NFD")];
  return (
    marks.length > 0 &&
    /^[a-zA-Z]$/.test(base ?? "") &&
    marks.every((m) => m in TONES || SHAPES.has(m))
  );
}

/** The Telex keys of a run of letters: shapes in place, the tone keys at the end ("óa" → "oas"). */
export function telexKeys(text: string): string {
  let letters = "";
  let tones = "";
  for (const ch of text) {
    if (ch === "đ" || ch === "Đ") {
      letters += ch === "đ" ? "dd" : "DD";
      continue;
    }
    if (!isVietnameseChar(ch)) {
      letters += ch;
      continue;
    }
    const [base, ...marks] = [...ch.normalize("NFD")];
    letters += base;
    for (const mark of marks) {
      if (mark in TONES) tones += TONES[mark];
      else if (mark === "̂") letters += base;
      else letters += base === base!.toUpperCase() ? "W" : "w";
    }
  }
  return letters + tones;
}

/** The one key that turned `before` into `after` (both as Vietnamese typing shows them). */
export function keyBetween(before: string, after: string): string {
  const from = telexKeys(before);
  const to = telexKeys(after);
  if (
    to.length > from.length &&
    to.toLowerCase().startsWith(from.toLowerCase())
  ) {
    return to.slice(from.length, from.length + 1);
  }
  // A mark on two letters ("uo" + "w" → "ươ"): the key that was added, once
  const left = [...from.toLowerCase()];
  const added: string[] = [];
  for (const ch of to) {
    const at = left.indexOf(ch.toLowerCase());
    if (at === -1) added.push(ch);
    else left.splice(at, 1);
  }
  if (added.length > 0) return added[added.length - 1]!;
  // An undo ("â" + "a" → "aa"): the key is the letter it ended with
  return [...to].pop() ?? "";
}

interface Segment {
  /** What Vietnamese typing believes is in the field */
  shown: string;
  /** What the field really holds: the keys pressed */
  keys: string;
}

interface Pending {
  before: Segment[];
  removed: number;
  at: number;
}

const LONE_W: Record<string, string> = { ư: "w", Ư: "W" };

// Vietnamese typing deletes and retypes within a few milliseconds
const REPLACE_WINDOW_MS = 150;

export interface KeyboardOnlyResult {
  value: string;
  /** Where the caret goes */
  caret: number;
  /** Something was typed that a password can't hold */
  dropped: boolean;
}

/** Follows one password field, change by change. */
export class KeyboardOnlyFilter {
  private segments: Segment[] = [];
  private pending: Pending | null = null;

  private get value() {
    return this.segments.map((s) => s.keys).join("");
  }

  private reset(value: string) {
    this.segments = [...value].map((ch) => ({ shown: ch, keys: ch }));
    this.pending = null;
  }

  /** `previous` is what the field held, `next` what the browser wants it to hold now. */
  change(previous: string, next: string, at: number): KeyboardOnlyResult {
    // The form changed the value itself (cleared it after a wrong password)
    if (this.value !== previous) this.reset(previous);

    const old = [...previous];
    const now = [...next];
    let start = 0;
    while (
      start < old.length &&
      start < now.length &&
      old[start] === now[start]
    )
      start++;
    let end = 0;
    while (
      end < old.length - start &&
      end < now.length - start &&
      old[old.length - 1 - end] === now[now.length - 1 - end]
    ) {
      end++;
    }
    const removed = old.length - start - end;
    const inserted = now.slice(start, now.length - end);

    if (end === 0 && inserted.length === 0 && removed > 0) {
      this.removeAtEnd(removed, at);
      return {
        value: this.value,
        caret: [...this.value].length,
        dropped: false,
      };
    }

    if (end === 0 && removed === 0) {
      const dropped = this.typeAtEnd(inserted, at);
      return { value: this.value, caret: [...this.value].length, dropped };
    }

    // An edit inside the text, or over a selection: keep it simple, keys only
    let dropped = false;
    const keys = inserted
      .map((ch) => {
        if (isKeyboardChar(ch)) return ch;
        if (isVietnameseChar(ch)) return telexKeys(ch);
        dropped = true;
        return "";
      })
      .join("");
    const value =
      old.slice(0, start).join("") +
      keys +
      old.slice(old.length - end).join("");
    this.reset(value);
    return {
      value,
      caret: [...(old.slice(0, start).join("") + keys)].length,
      dropped,
    };
  }

  private removeAtEnd(count: number, at: number) {
    if (!this.pending || at - this.pending.at > REPLACE_WINDOW_MS) {
      this.pending = {
        before: this.segments.map((s) => ({ ...s })),
        removed: 0,
        at,
      };
    }
    this.pending.removed += count;
    this.pending.at = at;

    let left = count;
    while (left > 0 && this.segments.length > 0) {
      const last = this.segments[this.segments.length - 1]!;
      const keys = [...last.keys];
      const take = Math.min(left, keys.length);
      last.keys = keys.slice(0, keys.length - take).join("");
      left -= take;
      if (last.keys === "") this.segments.pop();
    }
  }

  private typeAtEnd(inserted: string[], at: number): boolean {
    const pending = this.pending;
    this.pending = null;
    const replacing =
      pending !== null &&
      at - pending.at <= REPLACE_WINDOW_MS &&
      inserted.some(isVietnameseChar);

    if (replacing) {
      // Vietnamese typing replaced the last letters it showed: put back what it deleted,
      // then add only the one key that was pressed
      this.segments = pending.before;
      const popped: Segment[] = [];
      let shownCount = 0;
      while (shownCount < pending.removed && this.segments.length > 0) {
        const seg = this.segments.pop()!;
        popped.unshift(seg);
        shownCount += [...seg.shown].length;
      }
      const before = popped.map((s) => s.shown).join("");
      const kept = [...before].slice(0, shownCount - pending.removed).join("");
      const after = kept + inserted.join("");
      const keys =
        popped.map((s) => s.keys).join("") + keyBetween(before, after);
      this.segments.push({ shown: after, keys });
      return false;
    }

    let dropped = false;
    // Telex turns a lone "w" into "ư" without deleting anything: that one is the W key.
    // Any other letter (a phone keyboard's "ậ", or a paste) becomes all its keys.
    const loneW = inserted.length === 1 && LONE_W[inserted[0]!];
    for (const ch of inserted) {
      if (isKeyboardChar(ch)) this.segments.push({ shown: ch, keys: ch });
      else if (loneW) this.segments.push({ shown: ch, keys: loneW });
      else if (isVietnameseChar(ch))
        this.segments.push({ shown: ch, keys: telexKeys(ch) });
      else dropped = true;
    }
    return dropped;
  }
}
