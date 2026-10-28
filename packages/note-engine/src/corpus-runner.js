/**
 * Golden Note Corpus Runner (IM-39, docs/06-testing/note-corpus/README.md)
 *
 * Runs test cases against Note Understanding pipeline in rules mode or LLM mode,
 * validates against golden truth, and evaluates accuracy gates.
 */

import { processNote, processNoteWithFallback } from './pipeline.js';

export const ACCURACY_GATES = {
  counts: 0.95,
  dueDate: 0.95,
  startTime: 0.95,
  priority: 0.90,
  project: 0.90,
  repeat: 0.90,
  reminder: 0.90,
  commands: 1.00,
  safetyStatus: 1.00,
  nameRules: 1.00,
  nameLlm: 0.95,
};

/**
 * Run a suite of corpus cases
 *
 * @param {Array} cases Parsed YAML cases
 * @param {object} [options]
 * @param {string} [options.mode='rules'] 'rules' or 'llm'
 * @param {object} [options.fallbackService]
 * @returns {Promise<object>} Report with stats and pass/fail for each gate
 */
export async function runCorpus(cases, options = {}) {
  const mode = options.mode || 'rules';
  const fallbackService = options.fallbackService || null;

  const results = [];

  let countMatches = 0;
  let safetyMatches = 0;
  let nameMatches = 0;
  let commandMatches = 0;
  let totalCommands = 0;

  let totalCreates = 0;
  let dueDateMatches = 0;
  let startTimeMatches = 0;
  let priorityMatches = 0;
  let projectMatches = 0;
  let repeatMatches = 0;
  let reminderMatches = 0;

  for (const c of cases) {
    const input = {
      text: c.note,
      clientId: `c_${c.id}`,
      writtenAt: c.now ? `${c.now}:00+07:00` : '2026-10-23T08:12:00+07:00',
      timezone: c.timezone || 'Asia/Ho_Chi_Minh',
    };

    const userProjects = c.projects || ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'];
    const openTasks = (c.open_tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      due_date: t.due || null,
      start_time: t.start || null,
      end_time: t.end || null,
    }));
    const doneTasks = (c.done_tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      due_date: t.due || null,
    }));

    const context = {
      userProjects,
      openTasks,
      doneTasks,
      clockContext: {
        now: new Date(input.writtenAt),
        timezone: input.timezone,
      },
    };

    let actual;
    if (mode === 'llm') {
      actual = await processNoteWithFallback(input, context, fallbackService);
    } else {
      actual = processNote(input, context);
    }

    const expected = c.expect || {};

    // 1. Safety status match (Gate: 100%)
    const statusOk = actual.note.status === expected.status;
    if (statusOk) safetyMatches++;

    // 2. Note name match (Gate: 100% rules, 95% LLM)
    const nameOk = expected.name === undefined || actual.note.name === expected.name;
    if (nameOk) nameMatches++;

    // Collect actual creates, updates, deletes
    const actualCreates = [
      ...actual.changes.filter(ch => ch.kind === 'created').map(ch => ch.task),
      ...(actual.plan?.create || []),
    ];
    const actualUpdates = [
      ...actual.changes.filter(ch => ch.kind === 'updated').map(ch => ch.task),
      ...(actual.plan?.update || []),
    ];
    const actualDeletes = [
      ...actual.changes.filter(ch => ch.kind === 'deleted').map(ch => ch.task),
      ...(actual.plan?.delete || []),
    ];

    const expCreates = expected.create || [];
    const expUpdates = expected.update || [];
    const expDeletes = expected.delete || [];

    // 3. Exact counts of creates, updates, deletes (Gate: >= 95%)
    const countsOk =
      actualCreates.length === expCreates.length &&
      actualUpdates.length === expUpdates.length &&
      actualDeletes.length === expDeletes.length;
    if (countsOk) countMatches++;

    // 4. Command targeting (Gate: 100%)
    let caseCommandOk = true;
    if (expUpdates.length > 0 || expDeletes.length > 0 || (expected.ambiguous && expected.ambiguous.length > 0)) {
      totalCommands++;

      // Check ambiguous ties
      if (expected.ambiguous && expected.ambiguous.length > 0) {
        const expAmb = expected.ambiguous[0];
        const actAmb = actual.ambiguous?.[0];
        if (!actAmb || JSON.stringify(actAmb.candidates.sort()) !== JSON.stringify(expAmb.candidates.sort())) {
          caseCommandOk = false;
        }
      } else {
        // Check update task matching
        for (let i = 0; i < expUpdates.length; i++) {
          const expU = expUpdates[i];
          const actU = actualUpdates[i];
          const expTaskId = expU.task || expU.task_id;
          const actTaskId = actU?.id || actU?.task_id;
          if (expTaskId !== actTaskId) {
            caseCommandOk = false;
          }
        }
        // Check delete task matching
        for (let i = 0; i < expDeletes.length; i++) {
          const expD = expDeletes[i];
          const actD = actualDeletes[i];
          const expTaskId = typeof expD === 'string' ? expD : (expD.task || expD.task_id);
          const actTaskId = actD?.id || actD?.task_id;
          if (expTaskId !== actTaskId) {
            caseCommandOk = false;
          }
        }
      }

      if (caseCommandOk) commandMatches++;
    }

    // 5. Created task fields
    for (let i = 0; i < expCreates.length; i++) {
      totalCreates++;
      const expC = expCreates[i];
      const actC = actualCreates[i] || {};

      const expDue = expC.due || expC.due_date || null;
      const actDue = actC.due_date || null;
      if (expDue === actDue) dueDateMatches++;

      const expStart = expC.start || expC.start_time || null;
      const actStart = actC.start_time || null;
      if (expStart === actStart) startTimeMatches++;

      const expPriority = expC.priority || (expDue === '2026-10-23' ? 'medium' : 'low');
      const actPriority = actC.priority || 'low';
      if (expPriority === actPriority) priorityMatches++;

      const expProject = expC.project || expC.project_id || null;
      const actProject = actC.project_id || null;
      if (expProject === actProject) projectMatches++;

      const expRepeat = expC.repeat || 'never';
      const actRepeat = actC.repeat || 'never';
      if (expRepeat === actRepeat) repeatMatches++;

      const expReminder = expC.reminder || 'none';
      const actReminder = actC.reminder || 'none';
      if (expReminder === actReminder) reminderMatches++;
    }

    results.push({
      id: c.id,
      statusOk,
      nameOk,
      countsOk,
      commandOk: caseCommandOk,
      actual,
      expected,
    });
  }

  const totalCases = cases.length;
  const rates = {
    countsRate: totalCases > 0 ? countMatches / totalCases : 1,
    safetyStatusRate: totalCases > 0 ? safetyMatches / totalCases : 1,
    nameRate: totalCases > 0 ? nameMatches / totalCases : 1,
    commandsRate: totalCommands > 0 ? commandMatches / totalCommands : 1,
    dueDateRate: totalCreates > 0 ? dueDateMatches / totalCreates : 1,
    startTimeRate: totalCreates > 0 ? startTimeMatches / totalCreates : 1,
    priorityRate: totalCreates > 0 ? priorityMatches / totalCreates : 1,
    projectRate: totalCreates > 0 ? projectMatches / totalCreates : 1,
    repeatRate: totalCreates > 0 ? repeatMatches / totalCreates : 1,
    reminderRate: totalCreates > 0 ? reminderMatches / totalCreates : 1,
  };

  const nameGate = mode === 'rules' ? ACCURACY_GATES.nameRules : ACCURACY_GATES.nameLlm;

  const gates = {
    counts: rates.countsRate >= ACCURACY_GATES.counts,
    dueDate: rates.dueDateRate >= ACCURACY_GATES.dueDate,
    startTime: rates.startTimeRate >= ACCURACY_GATES.startTime,
    priority: rates.priorityRate >= ACCURACY_GATES.priority,
    project: rates.projectRate >= ACCURACY_GATES.project,
    repeat: rates.repeatRate >= ACCURACY_GATES.repeat,
    reminder: rates.reminderRate >= ACCURACY_GATES.reminder,
    commands: rates.commandsRate >= ACCURACY_GATES.commands,
    safetyStatus: rates.safetyStatusRate >= ACCURACY_GATES.safetyStatus,
    name: rates.nameRate >= nameGate,
  };

  const allPassed = Object.values(gates).every(Boolean);

  return {
    mode,
    totalCases,
    rates,
    gates,
    allPassed,
    results,
  };
}
