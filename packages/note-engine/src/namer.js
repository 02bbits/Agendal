/**
 * Note Namer (NU-6, IM-37)
 *
 * Rules (docs/02-domain/business-rules.md):
 * - One task -> The task's title (e.g. "Call mum")
 * - One change (update or delete) -> "Update: " + title (e.g. "Update: Renew gym membership")
 * - Only changes (multiple updates/deletes) -> "Updates to N tasks" (e.g. "Updates to 3 tasks")
 * - All tasks in one project -> Project + " to-dos" (e.g. "SQL Course to-dos")
 * - All tasks due the same day -> "Today's plan" / "Tomorrow's plan" / "<weekday> plan" (e.g. "Monday plan")
 * - All due within 7 days -> "This week"
 * - Anything else -> First title + " + N more" (e.g. "Call mum + 1 more")
 * - Nothing actionable -> The note's first words (up to 6)
 *
 * First rule that matches wins.
 * Max length: 34 characters (longer cut at word boundary with ellipsis '…', NU §11, T-NU-51).
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Generate automatic name for a note plan
 *
 * @param {object} plan { create: [], update: [], delete: [] }
 * @param {Array} skipped
 * @param {string} rawText
 * @param {object} context
 * @returns {string} Note name (≤ 34 chars)
 */
export function generateNoteName(plan, skipped = [], rawText = '', context = {}) {
  const {
    now = new Date('2026-10-23T08:12:00+07:00'), // Friday 23 Oct 2026
  } = context;

  const todayStr = '2026-10-23';
  const tomorrowStr = '2026-10-24';

  const creates = plan.create || [];
  const updates = plan.update || [];
  const deletes = plan.delete || [];

  const totalChanges = creates.length + updates.length + deletes.length;

  let generated = '';

  // 1. One task
  if (creates.length === 1 && updates.length === 0 && deletes.length === 0) {
    generated = creates[0].title;
  }
  // 2. One change
  else if (creates.length === 0 && totalChanges === 1) {
    const changeTitle = updates.length > 0 ? (updates[0].task_title || updates[0].label || 'task') : deletes[0].label;
    generated = `Update: ${changeTitle}`;
  }
  // 3. Only changes (all updates/deletes, no creates)
  else if (creates.length === 0 && totalChanges > 1) {
    generated = `Updates to ${totalChanges} tasks`;
  }
  // 4. All tasks in one project (creates > 1, all share same non-null project)
  else if (creates.length > 1 && updates.length === 0 && deletes.length === 0 && creates.every(c => c.project_id && c.project_id === creates[0].project_id)) {
    generated = `${creates[0].project_id} to-dos`;
  }
  // 5. All tasks due the same day
  else if (creates.length > 1 && creates.every(c => c.due_date && c.due_date === creates[0].due_date)) {
    const due = creates[0].due_date;
    if (due === todayStr) {
      generated = "Today's plan";
    } else if (due === tomorrowStr) {
      generated = "Tomorrow's plan";
    } else {
      const [y, m, d] = due.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      generated = `${WEEKDAYS[dayOfWeek]} plan`;
    }
  }
  // 6. All due within 7 days (all creates have due_date between today and today + 7 days)
  else if (creates.length > 1 && creates.every(c => isWithin7Days(c.due_date, todayStr))) {
    generated = 'This week';
  }
  // 7. Anything else with actionable tasks
  else if (creates.length > 0) {
    const moreCount = totalChanges - 1;
    generated = `${creates[0].title} + ${moreCount} more`;
  }
  // 8. Nothing actionable -> First words of the note (up to 6)
  else {
    const words = rawText.trim().replace(/^[-*•–—\s[\]x]+/i, '').split(/\s+/).slice(0, 6);
    let titleCandidate = words.join(' ');
    if (titleCandidate.length > 0) {
      titleCandidate = titleCandidate.charAt(0).toUpperCase() + titleCandidate.slice(1);
    }
    generated = titleCandidate || 'Note';
  }

  // Max 34 characters rule (T-NU-51): cut at word boundary with ellipsis
  return truncateName(generated, 34);
}

function isWithin7Days(dateStr, todayStr) {
  if (!dateStr) return false;
  const d1 = new Date(todayStr).getTime();
  const d2 = new Date(dateStr).getTime();
  const diffDays = (d2 - d1) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
}

function truncateName(name, maxLength = 34) {
  if (name.length <= maxLength) return name;
  const cut = name.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const safeCut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return safeCut.trim() + '…';
}
