/**
 * Non-task Item Classifier and Filter (NU-4, IM-34)
 *
 * Rules (§2.3):
 * 1. Skip: starts with idea, note, thought, remember that, fyi (with or without :),
 *    or whole item is filler (hmm, ok, okay, test, thanks, thank you, cool, lol, ừ, ừm, cảm ơn, thử),
 *    or Vietnamese skip: ý tưởng, ghi chú, lưu ý.
 *    Special rule: "remember to" is a lead-in for a TASK. "remember that" is a SKIP.
 * 2. Command: starts with command verb (done, finished, did, move, push, reschedule, postpone, delete, cancel, remove, drop;
 *    xong, đã xong, dời, chuyển, hoãn, xóa, xoá, hủy, huỷ, bỏ) or ends with "is done" / "xong rồi".
 *    Reschedule requires "to <when>" ("sang / qua / đến <when>"). Without it, the item is a task.
 * 3. Task: everything else. Items with no title words after extraction (e.g. "tomorrow 9am") become skip (NU-E32).
 */

import {
  SKIP_PREFIXES,
  FILLER_WORDS,
  COMMAND_VERBS
} from './dictionary.js';

export const ItemType = {
  SKIP: 'skip',
  COMMAND: 'command',
  TASK: 'task'
};

/**
 * Classify a split note item (§2.3)
 *
 * @param {string} itemText
 * @returns {{ type: 'skip' | 'command' | 'task', reason?: string, commandType?: 'complete' | 'reschedule' | 'delete' }}
 */
export function classifyItem(itemText) {
  const trimmed = itemText.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check for Skip
  // A. Entire item is filler
  // Clean punctuation from filler check (e.g. "ok thanks", "hmm", "thanks!")
  const cleanFiller = lower.replace(/[!.,?]+/g, '').trim();
  if (FILLER_WORDS.has(cleanFiller) || isCompositeFiller(cleanFiller)) {
    return { type: ItemType.SKIP, reason: 'skip' };
  }

  // B. Skip prefixes: idea, note, thought, remember that, fyi (with or without :)
  for (const prefix of SKIP_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix + ':') || lower.startsWith(prefix + ' ')) {
      return { type: ItemType.SKIP, reason: 'skip' };
    }
  }

  // "remember that" vs "remember to"
  if (lower.startsWith('remember that')) {
    return { type: ItemType.SKIP, reason: 'skip' };
  }

  // 2. Check for Command
  // A. Ends with "is done" or "xong rồi"
  if (/\b(is done)\b$/i.test(lower) || /\b(xong rồi)\b$/i.test(lower)) {
    return { type: ItemType.COMMAND, commandType: 'complete' };
  }

  // B. Starts with command verb
  const firstWord = lower.split(/[\s,.;:]+/)[0];

  // Complete commands
  if (['done', 'finished', 'did', 'xong', 'đã xong'].includes(firstWord)) {
    return { type: ItemType.COMMAND, commandType: 'complete' };
  }

  // Delete commands
  if (['delete', 'cancel', 'remove', 'drop', 'xóa', 'xoá', 'hủy', 'huỷ', 'bỏ'].includes(firstWord)) {
    return { type: ItemType.COMMAND, commandType: 'delete' };
  }

  // Reschedule commands (Must include "to <when>" or "sang/qua/đến <when>")
  if (['move', 'push', 'reschedule', 'postpone', 'dời', 'chuyển', 'hoãn'].includes(firstWord)) {
    if (/\b(to|sang|qua|đến)\b/i.test(lower)) {
      return { type: ItemType.COMMAND, commandType: 'reschedule' };
    }
    // Without target date, it remains a task! (§2.3)
  }

  // 3. Otherwise: Task
  return { type: ItemType.TASK };
}

function isCompositeFiller(str) {
  const parts = str.split(/\s+/);
  return parts.length > 0 && parts.every(p => FILLER_WORDS.has(p));
}
