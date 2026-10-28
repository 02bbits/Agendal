/**
 * Note Normalizer and Splitter (NU-1, IM-32)
 * Conforming to:
 * - docs/03-modules/NU-note-understanding.md (§2.1, §2.2)
 * - docs/02-domain/business-rules.md
 * - ADR-001, ADR-006, SC-24 (linear-time non-backtracking)
 */

import {
  TASK_VERBS_EN,
  TASK_VERBS_VI,
  COMMAND_VERBS,
  SKIP_PREFIXES,
  FILLER_WORDS,
  DATE_TIME_SIGNALS,
  KNOWN_ABBREVIATIONS,
} from './dictionary.js';

export class NoteSplitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NoteSplitError';
    this.code = code;
  }
}

/**
 * Normalise raw input text (NU §2.1 step 1):
 * - Unicode NFC
 * - Strip control characters except newline and tab
 * - Strip zero-width characters (\u200B-\u200D, \uFEFF)
 * - \r\n -> \n
 * - Trim
 */
export function normalizeNoteText(rawText) {
  if (typeof rawText !== 'string') {
    throw new NoteSplitError('note.empty', 'Note text must be a string');
  }

  // 1. Unicode NFC
  let text = rawText.normalize('NFC');

  // 2. Strip zero-width characters
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 3. Strip control characters except newline (\n) and tab (\t)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. Normalize newlines
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 5. Trim
  text = text.trim();

  // If nothing visible left
  if (text.length === 0) {
    throw new NoteSplitError('note.empty', 'Note text is empty');
  }

  return text;
}

/**
 * Strip bullets, numbering, checkboxes at start of line (NU §2.2, NU-E20)
 * e.g.:
 * - "- buy milk" -> "buy milk"
 * - "* item" -> "item"
 * - "• item" -> "item"
 * - "1. item" / "1) item" -> "item"
 * - "[ ] item" / "[x] item" -> "item"
 */
export function stripLineBullets(line) {
  let cleaned = line.trim();

  // Checkbox: [ ] or [x]
  cleaned = cleaned.replace(/^\[[ xX]\]\s*/, '');

  // Numbering: 1. or 1) or a)
  cleaned = cleaned.replace(/^(\d+|[a-zA-Z])[.)]\s*/, '');

  // Bullets: -, *, •, –
  cleaned = cleaned.replace(/^[-*•–—]\s*/, '');

  return cleaned.trim();
}

/**
 * Check if the text starts with a known task verb
 */
export function startsWithTaskVerb(text) {
  const lower = text.toLowerCase().trim();
  const firstWord = lower.split(/[\s,.;]+/)[0];

  if (TASK_VERBS_EN.has(firstWord) || TASK_VERBS_VI.has(firstWord)) {
    return true;
  }

  // Handle multi-word verbs like "set up", "chạy bộ", "đi chợ"
  for (const v of TASK_VERBS_VI) {
    if (lower.startsWith(v + ' ') || lower === v) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a fragment has its own action/time/skip signal (NU §2.2 comma merge rule)
 */
export function hasOwnSignal(fragment) {
  const lower = fragment.toLowerCase().trim();
  if (!lower) return false;

  const firstWord = lower.split(/[\s,.;]+/)[0];

  // 1. Starts with task verb
  if (startsWithTaskVerb(lower)) {
    return true;
  }

  // 2. Starts with command verb
  if (COMMAND_VERBS.has(firstWord)) {
    return true;
  }

  // 3. Skip prefix
  for (const prefix of SKIP_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }

  // 4. Date / time signals
  for (const signal of DATE_TIME_SIGNALS) {
    const regex = new RegExp(`\\b${signal}\\b`, 'i');
    if (regex.test(lower)) {
      return true;
    }
  }

  // 5. Explicit time (e.g. 9am, 14:00, 9h)
  if (/\b\d{1,2}(:\d{2}|h\d*|am|pm)\b/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Split text into initial raw chunks based on major boundaries:
 * - Newline (\n)
 * - Semicolon (;)
 * - Whole word "then" (case-insensitive, not inside words like "athens", NU-E17)
 * - Vietnamese "sau đó" or "rồi" ONLY when followed by words (NU-E41)
 * - Full stop followed by space or end of string, excluding abbreviations and numbers (NU-E19)
 */
function splitMajorBoundaries(text) {
  // First, split by newlines and strip line-start bullets
  const lines = text.split('\n').map(l => stripLineBullets(l)).filter(Boolean);
  const chunks = [];

  for (const line of lines) {
    // Semicolon
    const semiParts = line.split(';').map(s => s.trim()).filter(Boolean);

    for (const semi of semiParts) {
      // Split on whole-word "then"
      // Split on "sau đó" or "rồi" only if words follow
      let sub = semi;

      // Replace boundary markers safely
      // "then" with boundary
      sub = sub.replace(/\b(then)\b/gi, '___SPLIT___');

      // "sau đó" when followed by non-space/word
      sub = sub.replace(/\b(sau đó)\s+(?=\S)/gi, '___SPLIT___');

      // "rồi" when followed by word (not at the end of sentence like "xong rồi", NU-E41)
      sub = sub.replace(/\b(rồi)\s+(?=\S)/gi, '___SPLIT___');

      const splitWords = sub.split('___SPLIT___').map(s => s.trim()).filter(Boolean);

      for (const sw of splitWords) {
        // Full stop: split on '. ' or '.' at end, but not after abbreviations (Dr., Prof.) or inside numbers (9.30)
        const dotSplit = splitOnPeriods(sw);
        chunks.push(...dotSplit);
      }
    }
  }

  return chunks;
}

/**
 * Split on periods while respecting abbreviations and numeric decimals (NU-E19)
 */
function splitOnPeriods(text) {
  const result = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '.') {
      const nextChar = text[i + 1];
      const prevChar = text[i - 1];

      // 1. Between digits: 9.30 -> do not split
      if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
        current += char;
        continue;
      }

      // 2. Known abbreviations: Dr., Prof., etc.
      const lastWord = current.trim().split(/\s+/).pop().toLowerCase();
      if (KNOWN_ABBREVIATIONS.has(lastWord)) {
        current += char;
        continue;
      }

      // 3. Dot followed by non-space (e.g. file.pdf, a.b@c.com)
      if (nextChar && nextChar !== ' ') {
        current += char;
        continue;
      }

      // 4. Dot followed by space or at end of string -> delimiter!
      if (!nextChar || nextChar === ' ') {
        if (current.trim()) {
          result.push(current.trim());
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Split raw items by comma with Comma-List Merging rule (NU-1, NU-E33, NU-E18)
 * - Comma between digits ("1,000") never splits.
 * - Comma list after task verb merges ("buy milk, eggs and bread" -> 1 item).
 * - "dentist, haircut" splits (first has no verb).
 * - "buy ink, sql quiz monday" splits (second fragment has date/keyword signals).
 */
function processCommas(chunks) {
  const finalItems = [];

  for (const chunk of chunks) {
    // Split on commas that are NOT between digits (linear-time lookahead)
    // Matches comma only if not surrounded by digits
    const rawFragments = [];
    let curr = '';

    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (c === ',') {
        const prev = chunk[i - 1];
        const next = chunk[i + 1];
        if (/\d/.test(prev) && /\d/.test(next)) {
          // Number comma like 1,000 -> keep
          curr += c;
          continue;
        }

        if (curr.trim()) {
          rawFragments.push(curr.trim());
        }
        curr = '';
        continue;
      }
      curr += c;
    }

    if (curr.trim()) {
      rawFragments.push(curr.trim());
    }

    if (rawFragments.length <= 1) {
      if (rawFragments[0]) finalItems.push(rawFragments[0]);
      continue;
    }

    // Evaluate comma merge
    let currentItem = rawFragments[0];
    let startsVerb = startsWithTaskVerb(currentItem);

    for (let j = 1; j < rawFragments.length; j++) {
      const fragment = rawFragments[j];
      const fragmentHasSignal = hasOwnSignal(fragment);

      if (startsVerb && !fragmentHasSignal) {
        // MERGE!
        currentItem = `${currentItem}, ${fragment}`;
      } else {
        // SPLIT
        finalItems.push(currentItem);
        currentItem = fragment;
        startsVerb = startsWithTaskVerb(currentItem);
      }
    }

    if (currentItem.trim()) {
      finalItems.push(currentItem.trim());
    }
  }

  return finalItems;
}

/**
 * Main NoteSplitter function (NU-1, IM-32)
 *
 * @param {string} text Raw note input
 * @returns {string[]} Array of actionable/skip item strings
 * @throws {NoteSplitError} 'note.empty', 'note.too_long', 'note.too_many_items'
 */
export function splitNote(text) {
  // 1. Normalise
  const normalized = normalizeNoteText(text);

  // 2. Length check (max 5,000 chars)
  if (normalized.length > 5000) {
    throw new NoteSplitError('note.too_long', 'Note text exceeds maximum length of 5000 characters');
  }

  // 3. Initial split on major boundaries (newline, ;, then, period, rồi/sau đó)
  const chunks = splitMajorBoundaries(normalized);

  // 4. Process commas with comma-list merge logic
  const items = processCommas(chunks);

  // 5. Item count check (max 30 items)
  if (items.length > 30) {
    throw new NoteSplitError('note.too_many_items', 'Note contains more than 30 items');
  }

  return items;
}
