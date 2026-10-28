/**
 * Note Understanding Pipeline Orchestrator (NU Module, IM-37, ADR-001)
 *
 * Implements full 10-step pipeline (§2.1):
 * 1. Normalise (Unicode NFC, strip control & zero-width chars)
 * 2. Check length (<= 5,000 chars)
 * 3. Split into items (<= 30 items)
 * 4. Classify each item (skip, command, task)
 * 5. Extract fields and title for task items
 * 6. (Optional) LLM fallback for low-confidence items
 * 7. Match commands to open tasks
 * 8. Validate plan entries (drop invalid)
 * 9. Safety check decides status (done, confirm, followup)
 * 10. Generate note name
 * Output matches the NoteResult schema (packages/contracts/schemas/note-result.schema.json).
 */

import { splitNote } from './splitter.js';
import { extractTaskItem } from './extractor.js';
import { classifyItem, ItemType } from './classifier.js';
import { matchCommand } from './matcher.js';
import { validatePlan, decideSafetyStatus, NoteStatus } from './safety.js';
import { generateNoteName } from './namer.js';

/**
 * Process a raw note into a NoteResult plan
 *
 * @param {object} input
 * @param {string} input.text Raw note text
 * @param {string} input.clientId UUID v4
 * @param {string} [input.writtenAt] ISO 8601 string
 * @param {string} [input.timezone] IANA timezone name
 * @param {string|null} [input.sourceFileName]
 * @param {object} context User context (projects, openTasks, doneTasks)
 * @returns {object} NoteResult matching contract
 */
export function processNote(input, context = {}) {
  const startTime = Date.now();
  const {
    text,
    clientId,
    writtenAt = new Date().toISOString(),
    timezone = 'Asia/Ho_Chi_Minh',
    sourceFileName = null,
  } = input;

  const {
    userProjects = ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'],
    openTasks = [],
    doneTasks = [],
    clockContext = {
      now: new Date(writtenAt),
      timezone,
    },
  } = context;

  // 1-3. Normalise, Check length, Split
  const items = splitNote(text);

  const rawCreates = [];
  const rawUpdates = [];
  const rawDeletes = [];
  const skipped = [];
  const ambiguous = [];

  let skipIndex = 1;
  let createIndex = 1;

  // 4-7. Classify, Extract & Match
  for (const item of items) {
    // 200 ms security engine time limit per note (SC-24)
    if (Date.now() - startTime > 200) {
      // Degrade to raw text task creates
      rawCreates.push({
        ref: `c${createIndex++}`,
        title: item,
        priority: 'low',
        repeat: 'never',
        reminder: 'none',
      });
      continue;
    }

    const classification = classifyItem(item);

    // Skip items (§2.3)
    if (classification.type === ItemType.SKIP) {
      skipped.push({
        ref: `s${skipIndex++}`,
        text: item,
        reason: classification.reason || 'skip',
      });
      continue;
    }

    // Command items (§2.4)
    if (classification.type === ItemType.COMMAND) {
      const match = matchCommand(item, classification.commandType, openTasks, doneTasks, clockContext);

      if (match.matched) {
        if (match.isTie) {
          // Tie condition NU-E11 -> ambiguous candidates
          const ref = `u${rawUpdates.length + 1}`;
          ambiguous.push({
            ref,
            candidates: match.candidates,
            preselected: match.preselected,
          });
          rawUpdates.push({
            ref,
            task_id: match.preselected,
            done: true,
            label: 'Completed',
          });
        } else if (match.action === 'complete') {
          rawUpdates.push({
            ref: `u${rawUpdates.length + 1}`,
            task_id: match.targetTask.id,
            task_title: match.targetTask.title,
            done: true,
            label: match.label || 'Completed',
          });
        } else if (match.action === 'reschedule') {
          rawUpdates.push({
            ref: `u${rawUpdates.length + 1}`,
            task_id: match.targetTask.id,
            task_title: match.targetTask.title,
            due_date: match.targetDetails?.dueDate || null,
            start_time: match.targetDetails?.startTime || null,
            label: match.label,
          });
        } else if (match.action === 'delete') {
          rawDeletes.push({
            ref: `d${rawDeletes.length + 1}`,
            task_id: match.targetTask.id,
            label: match.label || match.targetTask.title,
          });
        }
      } else {
        // No match handling NU-E29
        if (match.action === 'create_fallback') {
          rawCreates.push({
            ref: `c${createIndex++}`,
            title: match.task.title,
            due_date: match.task.dueDate,
            start_time: match.task.startTime,
            priority: match.task.priority,
            repeat: 'never',
            reminder: 'none',
          });
        } else if (match.skipReason) {
          skipped.push({
            ref: `s${skipIndex++}`,
            text: item,
            reason: match.skipReason,
          });
        }
      }
      continue;
    }

    // Task items (§2.5)
    const extracted = extractTaskItem(item, {
      ...clockContext,
      userProjects,
    });

    if (extracted.isSkip) {
      skipped.push({
        ref: `s${skipIndex++}`,
        text: item,
        reason: 'skip',
      });
      continue;
    }

    rawCreates.push({
      ref: `c${createIndex++}`,
      title: extracted.title,
      due_date: extracted.dueDate,
      start_time: extracted.startTime,
      end_time: extracted.endTime,
      priority: extracted.priority,
      project_id: extracted.project,
      repeat: extracted.repeat,
      reminder: extracted.reminder,
      notes: extracted.notes,
      duplicate_of: null,
    });
  }

  // 8. Validate plan entries (§8)
  const openTaskIds = new Set(openTasks.map(t => t.id));
  const { plan: validatedPlan } = validatePlan({
    create: rawCreates,
    update: rawUpdates,
    delete: rawDeletes,
  }, { userProjects, openTaskIds });

  // 9. Safety status (§2.6)
  const status = decideSafetyStatus(validatedPlan, skipped, ambiguous);

  // 10. Generate note name
  const name = generateNoteName(validatedPlan, skipped, text, clockContext);

  // Format final payload
  const noteId = `n_${Date.now()}`;
  const processedAt = new Date().toISOString();

  // For 'done' status, changes lists applied tasks and plan is null
  let changes = [];
  let planOutput = null;

  if (status === NoteStatus.DONE) {
    changes = [
      ...validatedPlan.create.map(c => ({
        kind: 'created',
        label: formatTaskLabel(c),
        task: {
          id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: c.title,
          due_date: c.due_date,
          start_time: c.start_time,
          end_time: c.end_time,
          priority: c.priority,
          project_id: c.project_id,
          repeat: c.repeat,
          reminder: c.reminder,
          done: false,
          notes: c.notes,
        },
      })),
      ...validatedPlan.update.map(u => ({
        kind: 'updated',
        label: u.label,
        task: {
          id: u.task_id,
          title: u.task_title || 'Updated Task',
          due_date: u.due_date,
          start_time: u.start_time,
          done: u.done,
        },
      })),
      ...validatedPlan.delete.map(d => ({
        kind: 'deleted',
        label: d.label,
        task: {
          id: d.task_id,
          title: d.label,
        },
      })),
    ];
    planOutput = null;
  } else if (status === NoteStatus.FOLLOWUP) {
    changes = [];
    planOutput = null;
  } else {
    // For 'confirm', changes is empty and plan holds the proposals
    changes = [];
    planOutput = validatedPlan;
  }

  return {
    note: {
      id: noteId,
      client_id: clientId,
      status,
      name,
      text,
      source_file_name: sourceFileName,
      written_at: writtenAt,
      processed_at: processedAt,
      engine: 'rules',
    },
    changes,
    plan: planOutput,
    skipped,
    ambiguous,
  };
}

function formatTaskLabel(createItem) {
  const parts = [];
  if (createItem.due_date) {
    parts.push(createItem.due_date);
  }
  if (createItem.start_time) {
    parts.push(createItem.start_time);
  }
  if (createItem.project_id) {
    parts.push(createItem.project_id);
  }
  return parts.join(' · ') || createItem.title;
}
