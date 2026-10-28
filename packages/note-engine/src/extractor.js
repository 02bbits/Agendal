/**
 * Field Extractor for Note Understanding (NU-2, IM-33)
 *
 * Conforming to:
 * - docs/03-modules/NU-note-understanding.md (§2.5, §4)
 * - docs/02-domain/business-rules.md (English & Vietnamese phrase tables)
 * - ADR-006 (Floating local dates and times, pinned now/timezone)
 * - Edge cases NU-E1 to NU-E10, NU-E16, NU-E21 to NU-E25, NU-E30, NU-E31, NU-E34, NU-E40
 */

import { getLocalParts } from '../../clock/src/clock.js';
import { isLowConfidenceItem } from './llm-fallback.js';

export const KNOWN_ACRONYMS = new Set(['SQL', 'HCI', 'CV', 'UI', 'API', 'PDF']);

// Default course keywords per business rules
export const DEFAULT_PROJECT_KEYWORDS = {
  'SQL Course': ['sql', 'database', 'er diagram', 'er', 'bài tập sql', 'kiểm tra sql'],
  'Adv Web': ['adv web', 'web'],
  'HCI': ['hci'],
  'Portfolio': ['portfolio'],
  'Personal': ['gym', 'mum', 'groceries', 'mẹ', 'chợ']
};

function toDateStr(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toDateStr(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function getNextWeekday(baseDateStr, targetDay, isThis) {
  const currentDay = getDayOfWeek(baseDateStr);
  if (currentDay === targetDay) {
    return isThis ? baseDateStr : addDays(baseDateStr, 7);
  }
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;
  return addDays(baseDateStr, diff);
}

function getEndOfMonth(year, month) {
  const nextMonthFirst = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(nextMonthFirst.getTime() - 86400000);
  return toDateStr(lastDay.getUTCFullYear(), lastDay.getUTCMonth() + 1, lastDay.getUTCDate());
}

export function extractTaskItem(itemText, context = {}) {
  const {
    now = new Date('2026-10-23T08:12:00+07:00'),
    timezone = 'Asia/Ho_Chi_Minh',
    userProjects = ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'],
    projectKeywords = DEFAULT_PROJECT_KEYWORDS,
    weekStart = 'monday',
  } = context;

  const nowInstant = typeof now === 'string' ? new Date(now) : now;
  const localNow = getLocalParts(nowInstant, timezone);
  const todayStr = localNow.dateString;
  const currentH = localNow.hour;
  const currentM = localNow.minute;

  let raw = itemText.trim();
  let remaining = raw;
  const matchedPhrases = [];

  let dueDate = null;
  let startTime = null;
  let endTime = null;
  let priority = null;
  let projectId = null;
  let repeat = 'never';
  let reminder = 'none';
  let isLowConfidence = false;

  let isExamOrQuiz = false;

  // --- 1. Due Date Extraction ---
  if (/\b(today|hôm nay)\b/i.test(remaining)) {
    dueDate = todayStr;
    matchedPhrases.push(/\b(today|hôm nay)\b/i);
  } else if (/\b(tonight|this evening|tối nay)\b/i.test(remaining)) {
    dueDate = todayStr;
    if (!startTime && currentH < 20) {
      startTime = '20:00';
    }
    matchedPhrases.push(/\b(tonight|this evening|tối nay)\b/i);
  } else if (/\b(tomorrow|tmr|mai|ngày mai)\b/i.test(remaining)) {
    dueDate = addDays(todayStr, 1);
    matchedPhrases.push(/\b(tomorrow|tmr|mai|ngày mai)\b/i);
  } else if (/\b(day after tomorrow|mốt|ngày mốt)\b/i.test(remaining)) {
    dueDate = addDays(todayStr, 2);
    matchedPhrases.push(/\b(day after tomorrow|mốt|ngày mốt)\b/i);
  } else if (/\bin (\d+) days\b/i.test(remaining) || /(\d+) ngày nữa/i.test(remaining)) {
    const m = remaining.match(/\bin (\d+) days\b/i) || remaining.match(/(\d+) ngày nữa/i);
    const days = parseInt(m[1], 10);
    dueDate = addDays(todayStr, days);
    matchedPhrases.push(m[0]);
  } else if (/\bend of the month|cuối tháng\b/i.test(remaining)) {
    dueDate = getEndOfMonth(localNow.year, localNow.month);
    matchedPhrases.push(/\bend of the month|cuối tháng\b/i);
  } else if (/\bend of the week|cuối tuần\b/i.test(remaining)) {
    const targetEndDay = weekStart === 'sunday' ? 6 : 0;
    dueDate = getNextWeekday(todayStr, targetEndDay, true);
    matchedPhrases.push(/\bend of the week|cuối tuần\b/i);
  } else if (/\b(next week|tuần sau|tuần tới)\b/i.test(remaining)) {
    const targetFirstDay = weekStart === 'sunday' ? 0 : 1;
    const daysUntilNextWeek = (7 - getDayOfWeek(todayStr) + targetFirstDay) % 7 || 7;
    dueDate = addDays(todayStr, daysUntilNextWeek);
    matchedPhrases.push(/\b(next week|tuần sau|tuần tới)\b/i);
  }

  // Weekdays (Monday..Sunday, Thứ 2..CN, T2..T7)
  const weekdayMap = [
    { regex: /\b(this\s+)?(sunday|chủ nhật|cn)\b/i, day: 0 },
    { regex: /\b(this\s+)?(monday|thứ (hai|2)|t2)\b/i, day: 1 },
    { regex: /\b(this\s+)?(tuesday|thứ (ba|3)|t3)\b/i, day: 2 },
    { regex: /\b(this\s+)?(wednesday|thứ (tư|4)|t4)\b/i, day: 3 },
    { regex: /\b(this\s+)?(thursday|thứ (năm|5)|t5)\b/i, day: 4 },
    { regex: /\b(this\s+)?(friday|thứ (sáu|6)|t6)\b/i, day: 5 },
    { regex: /\b(this\s+)?(saturday|thứ (bảy|7)|t7)\b/i, day: 6 },
  ];

  if (!dueDate) {
    const weekdayMatches = [];
    for (const w of weekdayMap) {
      const match = remaining.match(w.regex);
      if (match) {
        const isThis = !!match[1] || /\bthis\b/i.test(match[0]);
        const targetDate = getNextWeekday(todayStr, w.day, isThis);
        const matchIdx = match.index;
        const prefixStr = remaining.slice(Math.max(0, matchIdx - 15), matchIdx);
        const hasPrep = /\b(by|on|due|before|vào|trước)\s*$/i.test(prefixStr);
        const prepMatch = remaining.match(new RegExp(`\\b(by|on|due|before|vào|sang|đến|trước)\\s+${escapeRegExp(match[0])}`, 'i'));
        weekdayMatches.push({
          matchStr: prepMatch ? prepMatch[0] : match[0],
          targetDate,
          hasPrep: hasPrep || !!prepMatch,
          index: matchIdx,
        });
      }
    }

    if (weekdayMatches.length === 1) {
      dueDate = weekdayMatches[0].targetDate;
      matchedPhrases.push(weekdayMatches[0].matchStr);
    } else if (weekdayMatches.length > 1) {
      // NU-E6: The date after by / due / on / before wins. Otherwise the later date.
      const prepWinner = weekdayMatches.find(m => m.hasPrep);
      const winner = prepWinner || weekdayMatches.slice().sort((a, b) => b.targetDate.localeCompare(a.targetDate))[0];
      dueDate = winner.targetDate;
      matchedPhrases.push(winner.matchStr);
    }
  }

  // Explicit dates
  const explicitMonthRegex = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|tháng \d{1,2})\b/i;
  const explicitNumRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/;

  const monthNames = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  const expMatch = remaining.match(explicitMonthRegex);
  if (expMatch && !dueDate) {
    const d = parseInt(expMatch[1], 10);
    let m;
    if (expMatch[2].toLowerCase().startsWith('tháng')) {
      m = parseInt(expMatch[2].replace(/\D/g, ''), 10);
    } else {
      m = monthNames[expMatch[2].toLowerCase().slice(0, 3)];
    }
    const year = localNow.year;
    let target = toDateStr(year, m, d);

    const diffDays = (new Date(target) - new Date(todayStr)) / 86400000;
    if (diffDays < -30) {
      target = toDateStr(year + 1, m, d);
    }
    dueDate = target;
    matchedPhrases.push(expMatch[0]);
  } else {
    const numMatch = remaining.match(explicitNumRegex);
    if (numMatch && !dueDate) {
      const d = parseInt(numMatch[1], 10);
      const m = parseInt(numMatch[2], 10);
      const y = numMatch[3] ? parseInt(numMatch[3], 10) : localNow.year;

      const maxDays = (m >= 1 && m <= 12) ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
      if (m >= 1 && m <= 12 && d >= 1 && d <= maxDays) {
        let target = toDateStr(y, m, d);
        if (!numMatch[3]) {
          const diffDays = (new Date(target) - new Date(todayStr)) / 86400000;
          if (diffDays < -30) {
            target = toDateStr(y + 1, m, d);
          }
        }
        dueDate = target;
        matchedPhrases.push(numMatch[0]);
      } else {
        isLowConfidence = true;
      }
    }
  }

  // --- 2. Time Extraction ---
  // Range: 2-4pm, 14:00-16:00
  const rangeMatch = remaining.match(/\b(?:from\s+)?(\d{1,2}(?::\d{2})?(?:am|pm)?)\s*(?:-|to|đến)\s*(\d{1,2}(?::\d{2})?(?:am|pm)?)\b/i);
  if (rangeMatch) {
    const isSecondPm = /pm/i.test(rangeMatch[2]);
    startTime = normalizeTimeStr(rangeMatch[1], isSecondPm);
    endTime = normalizeTimeStr(rangeMatch[2]);
    matchedPhrases.push(rangeMatch[0]);
  }

  if (!startTime) {
    // Check Vietnamese complex time: "lúc 2 giờ chiều", "2 giờ chiều", "9 giờ 30", "9h30"
    const viComplexTime = remaining.match(/\b(?:lúc\s+)?(\d{1,2})\s*(?:giờ|h)(?:\s*(\d{2}))?(?:\s*(sáng|trưa|chiều|tối))?\b/i);
    const enTime = remaining.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2})|\.(\d{2}))?\s*(am|pm)?\b/i);

    if (viComplexTime) {
      let h = parseInt(viComplexTime[1], 10);
      let min = parseInt(viComplexTime[2] || '0', 10);
      const period = viComplexTime[3] ? viComplexTime[3].toLowerCase() : null;

      if (period === 'chiều' && h < 12) h += 12;
      else if (period === 'tối' && h < 12) h += 12;
      else if (period === 'trưa' && h === 12) h = 12;

      startTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      matchedPhrases.push(viComplexTime[0].trim());
    } else if (enTime && (enTime[2] || enTime[3] || enTime[4] || enTime[0].toLowerCase().startsWith('at '))) {
      let h = parseInt(enTime[1], 10);
      let min = parseInt(enTime[2] || enTime[3] || '0', 10);
      const ampm = enTime[4] ? enTime[4].toLowerCase() : null;

      if (ampm === 'pm' && h < 12) h += 12;
      else if (ampm === 'am' && h === 12) h = 0;
      else if (!ampm && !enTime[2] && !enTime[3]) {
        // Bare hour (NU-E7)
        if (h >= 1 && h <= 6) h += 12;
      }

      startTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      matchedPhrases.push(enTime[0].trim());
    } else {
      // Time words
      if (/\b(morning|sáng)\b/i.test(remaining) && !startTime) {
        startTime = '09:00';
        matchedPhrases.push(/\b(morning|sáng)\b/i);
      } else if (/\b(noon|trưa)\b/i.test(remaining) && !startTime) {
        startTime = '12:00';
        matchedPhrases.push(/\b(noon|trưa)\b/i);
      } else if (/\b(evening|chiều)\b/i.test(remaining) && !startTime) {
        startTime = '15:00';
        matchedPhrases.push(/\b(evening|chiều)\b/i);
      }
    }
  }

  // Time passed with no date -> tomorrow (NU-E5)
  if (startTime && !dueDate) {
    const [sh, sm] = startTime.split(':').map(Number);
    if (sh < currentH || (sh === currentH && sm <= currentM)) {
      dueDate = addDays(todayStr, 1);
    } else {
      dueDate = todayStr;
    }
  }

  // --- 3. Repeat Extraction ---
  if (/\b(every day|daily|mỗi ngày|hằng ngày|hàng ngày)\b/i.test(remaining)) {
    repeat = 'daily';
    matchedPhrases.push(/\b(every day|daily|mỗi ngày|hằng ngày|hàng ngày)\b/i);
    if (!dueDate) dueDate = todayStr;
  } else if (/\b(every week|weekly|mỗi tuần|hằng tuần)\b/i.test(remaining)) {
    repeat = 'weekly';
    matchedPhrases.push(/\b(every week|weekly|mỗi tuần|hằng tuần)\b/i);
    if (!dueDate) dueDate = todayStr;
  } else if (/\b(every month|monthly|mỗi tháng|hằng tháng)\b/i.test(remaining)) {
    repeat = 'monthly';
    matchedPhrases.push(/\b(every month|monthly|mỗi tháng|hằng tháng)\b/i);
    if (!dueDate) dueDate = todayStr;
  } else {
    for (const w of weekdayMap) {
      const ewRegex = new RegExp(`\\b(every|mỗi)\\s+${w.regex.source.replace('\\b(this\\s+)?', '')}`, 'i');
      const m = remaining.match(ewRegex);
      if (m) {
        repeat = 'weekly';
        dueDate = getNextWeekday(todayStr, w.day, false);
        matchedPhrases.push(m[0]);
        break;
      }
    }
  }

  // --- 4. Priority Extraction ---
  if (/\b(deadline|exam|quiz|submit|hạn chót|thi|kiểm tra|nộp)\b/i.test(remaining)) {
    priority = 'high';
    if (/\b(exam|quiz|thi|kiểm tra)\b/i.test(remaining)) {
      isExamOrQuiz = true;
    }
  }

  const pureHighRegex = /\b(urgent|asap|important|high priority|gấp|khẩn|quan trọng|ưu tiên)\b/i;
  const pureLowRegex = /\b(low priority|whenever|someday|maybe|không gấp|khi nào rảnh)\b/i;

  if (pureHighRegex.test(remaining)) {
    priority = 'high';
    matchedPhrases.push(pureHighRegex);
  }
  if (pureLowRegex.test(remaining)) {
    if (!priority) {
      priority = 'low';
    }
    matchedPhrases.push(pureLowRegex);
  }

  if (!priority) {
    priority = dueDate === todayStr ? 'medium' : 'low';
  }

  // --- 5. Project Matching ---
  for (const proj of userProjects) {
    const projRegex = new RegExp(`\\b${escapeRegExp(proj)}\\b`, 'i');
    if (projRegex.test(remaining)) {
      projectId = proj;
      break;
    }
  }

  if (!projectId) {
    for (const [projName, keywords] of Object.entries(projectKeywords)) {
      if (!userProjects.includes(projName)) continue;
      for (const kw of keywords) {
        const kwRegex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
        if (kwRegex.test(remaining)) {
          projectId = projName;
          break;
        }
      }
      if (projectId) break;
    }
  }

  // --- 6. Reminder Logic ---
  if (isExamOrQuiz) {
    reminder = '1d';
  } else if (startTime) {
    reminder = '15m';
  } else {
    reminder = 'none';
  }

  // --- 7. Title Cleanup ---
  let cleanedTitle = remaining;

  // Sort matchedPhrases by length descending so longer composite phrases are removed first
  matchedPhrases.sort((a, b) => {
    const lenA = typeof a === 'string' ? a.length : (a.source?.length || 0);
    const lenB = typeof b === 'string' ? b.length : (b.source?.length || 0);
    return lenB - lenA;
  });

  for (const p of matchedPhrases) {
    if (p instanceof RegExp) {
      cleanedTitle = cleanedTitle.replace(p, ' ');
    } else if (typeof p === 'string' && p.trim()) {
      const trimmedP = p.trim();
      cleanedTitle = cleanedTitle.replace(new RegExp(`\\b${escapeRegExp(trimmedP)}\\b`, 'gi'), ' ');
    }
  }

  const leadIns = [
    /\b(remember to|i need to|please)\b/gi,
    /\b(nhớ|phải|cần|cần phải)\b/gi,
  ];
  for (const li of leadIns) {
    cleanedTitle = cleanedTitle.replace(li, ' ');
  }

  cleanedTitle = cleanedTitle
    .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip dangling prepositions left when date/time/repeat was removed
  cleanedTitle = cleanedTitle
    .replace(/\b(by|on|due|at|before|every|mỗi|vào|lúc|trước|sang|đến)\s*$/gi, '')
    .replace(/^\s*\b(by|on|due|at|before|every|mỗi|vào|lúc|trước|sang|đến)\b/gi, '')
    .replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (projectId) {
    const projRegex = new RegExp(`\\b${escapeRegExp(projectId)}\\b`, 'gi');
    cleanedTitle = cleanedTitle.replace(projRegex, projectId);
  }

  for (const ac of KNOWN_ACRONYMS) {
    const acRegex = new RegExp(`\\b${escapeRegExp(ac)}\\b`, 'gi');
    cleanedTitle = cleanedTitle.replace(acRegex, ac);
  }

  if (cleanedTitle.length > 0) {
    cleanedTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
  }

  let taskNotes = null;
  if (cleanedTitle.length > 200) {
    const cutIdx = cleanedTitle.lastIndexOf(' ', 200);
    const validCut = cutIdx > 0 ? cutIdx : 200;
    taskNotes = cleanedTitle.slice(validCut).trim();
    cleanedTitle = cleanedTitle.slice(0, validCut).trim();
  }

  if (!cleanedTitle) {
    return {
      isSkip: true,
      reason: 'skip',
      rawText: raw,
    };
  }

  if (isLowConfidenceItem(raw)) {
    isLowConfidence = true;
  }

  return {
    isSkip: false,
    title: cleanedTitle,
    dueDate,
    startTime,
    endTime,
    priority,
    project: projectId,
    repeat,
    reminder,
    notes: taskNotes,
    isLowConfidence,
  };
}

function normalizeTimeStr(t, referencePm = false) {
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  let ampm = m[3] ? m[3].toLowerCase() : null;
  if (!ampm && referencePm && h < 12) {
    ampm = 'pm';
  }
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
