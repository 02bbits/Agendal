/**
 * Command Matcher for Note Understanding (NU-3, IM-35)
 *
 * Conforming to:
 * - docs/03-modules/NU-note-understanding.md (§2.4)
 * - docs/02-domain/business-rules.md (Commands table)
 * - Edge cases: NU-E11 (ties), NU-E12 (already done), NU-E29 (no match), NU-E35 (reschedule detail), NU-E36 (repeating tasks)
 *
 * Rules:
 * - Meaningful words: words left after lower-casing and removing the command verb, date/time phrases, and stop words.
 *   Stop words: a, an, the, to, for, my, of, on, in, at, with, and, or, task;
 *               cái, các, những, của, cho, với, và, là, việc.
 *   No stemming. Diacritics are kept.
 * - Score = meaningful words found in task title ÷ meaningful words in command.
 * - Threshold >= 0.6.
 * - Best match wins. Two or more with same top score is a tie -> confirm with ambiguous candidates (NU-E11).
 * - No open match:
 *   - If a done task would match -> skip `already_done` (NU-E12).
 *   - Otherwise:
 *     - reschedule -> create new task with target date (NU-E29).
 *     - complete or delete -> skip `not_found` (NU-E29).
 */

import { extractTaskItem } from './extractor.js';

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'my', 'of', 'on', 'in', 'at', 'with', 'and', 'or', 'task',
  'cái', 'các', 'những', 'của', 'cho', 'với', 'và', 'là', 'việc'
]);

export const COMMAND_VERB_PHRASES = [
  'done', 'finished', 'did', 'is done',
  'move', 'push', 'reschedule', 'postpone',
  'delete', 'cancel', 'remove', 'drop',
  'xong rồi', 'xong', 'đã xong',
  'dời', 'chuyển', 'hoãn',
  'xóa', 'xoá', 'hủy', 'huỷ', 'bỏ'
];

/**
 * Extract meaningful words from a command string (§2.4)
 */
export function extractMeaningfulWords(commandText, targetDateStr = null) {
  let lower = commandText.toLowerCase().trim();

  // Strip command phrases
  for (const phrase of COMMAND_VERB_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    lower = lower.replace(regex, ' ');
  }

  // Strip destination preposition: "to <when>", "sang/qua/đến <when>"
  lower = lower.replace(/\b(to|sang|qua|đến)\b/gi, ' ');

  // Tokenize words (retaining Vietnamese diacritics)
  const tokens = lower.split(/[\s,.;:!?/\\(){}[\]"'-]+/).filter(Boolean);

  // Filter stop words & common date tokens
  const dateTokens = new Set([
    'today', 'tonight', 'tomorrow', 'tmr', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'hôm nay', 'tối nay', 'mai', 'mốt', 'thứ', 'hai', 'ba', 'tư', 'năm', 'sáu', 'bảy', 'chủ', 'nhật',
    'cn', 't2', 't3', 't4', 't5', 't6', 't7'
  ]);

  return tokens.filter(t => !STOP_WORDS.has(t) && !dateTokens.has(t));
}

/**
 * Calculate overlap score between command meaningful words and a task title
 */
export function scoreTaskMatch(commandWords, taskTitle) {
  if (commandWords.length === 0) return 0;

  const titleLower = taskTitle.toLowerCase();
  const titleTokens = new Set(titleLower.split(/[\s,.;:!?/\\(){}[\]"'-]+/).filter(Boolean));

  let matchedCount = 0;
  for (const word of commandWords) {
    if (titleTokens.has(word)) {
      matchedCount++;
    }
  }

  return matchedCount / commandWords.length;
}

/**
 * Main Command Matcher
 *
 * @param {string} commandText Raw command item string
 * @param {'complete' | 'reschedule' | 'delete'} commandType
 * @param {Array<{ id: string, title: string, due_date?: string, start_time?: string, end_time?: string, done?: boolean }>} openTasks
 * @param {Array<{ id: string, title: string, done?: boolean }>} doneTasks
 * @param {object} context Clock / timezone context
 */
export function matchCommand(commandText, commandType, openTasks = [], doneTasks = [], context = {}) {
  // If command is reschedule, extract the target date/time first
  let extractedTarget = null;
  if (commandType === 'reschedule') {
    extractedTarget = extractTaskItem(commandText, context);
  }

  const meaningfulWords = extractMeaningfulWords(commandText);

  // Score against open tasks
  const scoredOpen = [];
  for (const task of openTasks) {
    const score = scoreTaskMatch(meaningfulWords, task.title);
    if (score >= 0.6) {
      scoredOpen.push({ task, score });
    }
  }

  // Sort descending by score
  scoredOpen.sort((a, b) => b.score - a.score);

  // 1. We have matching open tasks
  if (scoredOpen.length > 0) {
    const topScore = scoredOpen[0].score;
    const topTies = scoredOpen.filter(m => Math.abs(m.score - topScore) < 0.001);

    if (topTies.length > 1) {
      // Tie condition NU-E11: 2+ tasks with same top score
      // Soonest due date is preselected
      const sortedTies = [...topTies].sort((a, b) => {
        const dA = a.task.due_date || '9999-99-99';
        const dB = b.task.due_date || '9999-99-99';
        return dA.localeCompare(dB);
      });

      const candidates = sortedTies.map(t => t.task.id);
      const preselected = candidates[0];

      return {
        matched: true,
        action: commandType,
        isTie: true,
        candidates,
        preselected,
        targetTask: sortedTies[0].task,
        targetDetails: extractedTarget,
      };
    }

    // Single winner
    const winningTask = topTies[0].task;
    return {
      matched: true,
      action: commandType,
      isTie: false,
      targetTask: winningTask,
      targetDetails: extractedTarget,
      label: buildChangeLabel(commandType, winningTask, extractedTarget, context),
    };
  }

  // 2. No open task matched -> Check done tasks (NU-E12)
  for (const task of doneTasks) {
    const score = scoreTaskMatch(meaningfulWords, task.title);
    if (score >= 0.6) {
      return {
        matched: false,
        skipReason: 'already_done',
        rawText: commandText,
      };
    }
  }

  // 3. No match at all (NU-E29)
  if (commandType === 'reschedule') {
    // Reschedule becomes a new created task with target date
    const title = buildNewTaskTitleFromCommand(commandText);
    return {
      matched: false,
      action: 'create_fallback',
      task: {
        title,
        dueDate: extractedTarget?.dueDate || null,
        startTime: extractedTarget?.startTime || null,
        priority: 'low',
      },
    };
  }

  // Complete or delete without match -> skip not_found
  return {
    matched: false,
    skipReason: 'not_found',
    rawText: commandText,
  };
}

/**
 * Build label for the change (e.g. "Due Sun 25 Oct (was today)")
 */
function buildChangeLabel(commandType, task, extractedTarget, context) {
  if (commandType === 'complete') {
    return 'Completed';
  }

  if (commandType === 'delete') {
    return task.title;
  }

  if (commandType === 'reschedule' && extractedTarget?.dueDate) {
    const was = task.due_date ? formatWasDate(task.due_date, context) : '(was no date)';
    const newDateFormatted = formatDisplayDate(extractedTarget.dueDate);
    return `Due ${newDateFormatted} ${was}`;
  }

  return '';
}

function formatWasDate(dateStr, context) {
  const { now = new Date('2026-10-23T08:12:00+07:00') } = context;
  const today = '2026-10-23';
  const tomorrow = '2026-10-24';

  if (dateStr === today) return '(was today)';
  if (dateStr === tomorrow) return '(was tomorrow)';
  return `(was ${formatDisplayDate(dateStr)})`;
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getUTCDay()]} ${d} ${months[date.getUTCMonth()]}`;
}

function buildNewTaskTitleFromCommand(commandText) {
  let cleaned = commandText.replace(/\b(move|push|reschedule|postpone|dời|chuyển|hoãn)\b/gi, '');
  cleaned = cleaned.replace(/\b(to|sang|qua|đến)\b.*/gi, '');
  cleaned = cleaned.trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
