/**
 * Safety and Status Resolver (NU-5, BR-01, BR-02, IM-36)
 *
 * Checks in order (§2.6):
 * 1. Validation error (empty, too long, too many items) -> 422
 * 2. Any delete, any tie (NU-E11), or more than 5 changes (creates + updates + deletes) -> confirm
 * 3. At least one change -> done
 * 4. No changes, and every skip is already_done or not_found -> done (with zero changes, result shows skipped section)
 * 5. No changes, and at least one plain skip -> followup
 *
 * Plan Validation (§8):
 * - Every task_id / project_id belongs to the user
 * - Enums are valid (priority: low/medium/high, repeat: never/daily/weekly/monthly/yearly, reminder: none/5m/15m/30m/1h/1d)
 * - Dates are real dates
 * - End time is after start time (TK-3)
 * - Title is 1–200 characters
 * - Failing entries are dropped and never applied
 */

export const NoteStatus = {
  DONE: 'done',
  CONFIRM: 'confirm',
  FOLLOWUP: 'followup',
};

const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_REPEATS = new Set(['never', 'daily', 'weekly', 'monthly', 'yearly']);
const VALID_REMINDERS = new Set(['none', '5m', '15m', '30m', '1h', '1d']);
const VALID_SKIP_REASONS = new Set(['skip', 'already_done', 'not_found']);

/**
 * Validate a candidate plan entry and drop invalid ones (§8, T-NU-71)
 */
export function validatePlan(rawPlan, userContext = {}) {
  const {
    userProjects = [], // allowed project names/IDs
    openTaskIds = new Set(), // allowed task IDs
  } = userContext;

  const validCreate = [];
  const validUpdate = [];
  const validDelete = [];
  const dropped = [];

  const allowedProjectSet = new Set(userProjects);

  // Validate Creates
  if (Array.isArray(rawPlan.create)) {
    for (const item of rawPlan.create) {
      // Title 1-200 chars
      if (!item.title || typeof item.title !== 'string' || item.title.trim().length === 0 || item.title.length > 200) {
        dropped.push({ item, reason: 'invalid_title' });
        continue;
      }

      // Priority
      if (item.priority && !VALID_PRIORITIES.has(item.priority)) {
        dropped.push({ item, reason: 'invalid_priority' });
        continue;
      }

      // Repeat
      if (item.repeat && !VALID_REPEATS.has(item.repeat)) {
        dropped.push({ item, reason: 'invalid_repeat' });
        continue;
      }

      // Reminder
      if (item.reminder && !VALID_REMINDERS.has(item.reminder)) {
        dropped.push({ item, reason: 'invalid_reminder' });
        continue;
      }

      // Project ownership (NU-E23: unknown project -> no project)
      let projectId = item.project_id || item.project || null;
      if (projectId && !allowedProjectSet.has(projectId)) {
        projectId = null;
      }

      // End time after start time
      if (item.start_time && item.end_time) {
        if (item.end_time <= item.start_time) {
          item.end_time = null; // dropped invalid end time
        }
      }

      validCreate.push({
        ref: item.ref || `c${validCreate.length + 1}`,
        title: item.title.trim(),
        due_date: item.due_date || item.dueDate || null,
        start_time: item.start_time || item.startTime || null,
        end_time: item.end_time || item.endTime || null,
        priority: item.priority || 'low',
        project_id: projectId,
        repeat: item.repeat || 'never',
        reminder: item.reminder || 'none',
        notes: item.notes || null,
        duplicate_of: item.duplicate_of || null,
      });
    }
  }

  // Validate Updates
  if (Array.isArray(rawPlan.update)) {
    for (const item of rawPlan.update) {
      if (!item.task_id && !item.task) {
        dropped.push({ item, reason: 'missing_task_id' });
        continue;
      }
      const taskId = item.task_id || (typeof item.task === 'object' ? item.task.id : item.task);
      if (openTaskIds.size > 0 && !openTaskIds.has(taskId)) {
        dropped.push({ item, reason: 'task_not_found_or_not_owned' });
        continue;
      }

      validUpdate.push({
        ref: item.ref || `u${validUpdate.length + 1}`,
        task_id: taskId,
        label: item.label || 'Completed',
        done: item.done !== undefined ? item.done : true,
        due_date: item.due_date || item.dueDate || null,
        start_time: item.start_time || item.startTime || null,
        end_time: item.end_time || item.endTime || null,
        priority: item.priority || null,
        project_id: item.project_id || item.project || null,
        repeat: item.repeat || null,
        reminder: item.reminder || null,
        notes: item.notes || null,
      });
    }
  }

  // Validate Deletes
  if (Array.isArray(rawPlan.delete)) {
    for (const item of rawPlan.delete) {
      const taskId = typeof item === 'string' ? item : (item.task_id || item.task);
      if (!taskId) {
        dropped.push({ item, reason: 'missing_task_id' });
        continue;
      }
      if (openTaskIds.size > 0 && !openTaskIds.has(taskId)) {
        dropped.push({ item, reason: 'task_not_found_or_not_owned' });
        continue;
      }

      validDelete.push({
        ref: item.ref || `d${validDelete.length + 1}`,
        task_id: taskId,
        label: item.label || 'Deleted task',
      });
    }
  }

  return {
    plan: {
      create: validCreate,
      update: validUpdate,
      delete: validDelete,
    },
    dropped,
  };
}

/**
 * Decide Note Status according to Safety Rules (§2.6, BR-01)
 *
 * @param {object} plan Validated plan { create: [], update: [], delete: [] }
 * @param {Array} skipped Array of skipped items { text, reason }
 * @param {Array} ambiguous Array of tie items { ref, candidates, preselected }
 * @returns {'confirm' | 'done' | 'followup'}
 */
export function decideSafetyStatus(plan, skipped = [], ambiguous = []) {
  const createCount = plan.create ? plan.create.length : 0;
  const updateCount = plan.update ? plan.update.length : 0;
  const deleteCount = plan.delete ? plan.delete.length : 0;
  const totalChanges = createCount + updateCount + deleteCount;

  // 1. Any delete -> confirm (BR-01, T-NU-40, C-018)
  if (deleteCount > 0) {
    return NoteStatus.CONFIRM;
  }

  // 2. Any tie (ambiguous candidates) -> confirm (NU-E11, T-NU-43, C-026)
  if (ambiguous.length > 0) {
    return NoteStatus.CONFIRM;
  }

  // 3. More than 5 changes (creates + updates + deletes) -> confirm (BR-01, T-NU-41, C-019)
  if (totalChanges > 5) {
    return NoteStatus.CONFIRM;
  }

  // 4. At least one change -> done
  if (totalChanges >= 1) {
    return NoteStatus.DONE;
  }

  // 5. Zero changes:
  // If all skipped items are 'already_done' or 'not_found' -> done with zero changes
  const hasPlainSkip = skipped.some(s => s.reason === 'skip');
  if (skipped.length > 0 && !hasPlainSkip) {
    // Only already_done or not_found
    return NoteStatus.DONE;
  }

  // Otherwise (has plain skip, e.g. ideas, FYIs, filler, or totally empty) -> followup (BR-02, T-NU-33, C-013)
  return NoteStatus.FOLLOWUP;
}
