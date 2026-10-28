import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideSafetyStatus,
  validatePlan,
  NoteStatus,
} from '../src/index.js';

// --- Tests T-NU-40 to T-NU-43 ---

test('T-NU-40 & C-018: Any delete triggers confirm status', () => {
  const plan = {
    create: [],
    update: [],
    delete: [{ ref: 'd1', task_id: 't1', label: 'Old reading list' }],
  };
  const status = decideSafetyStatus(plan);
  assert.equal(status, NoteStatus.CONFIRM);
});

test('T-NU-41 & C-019: 5 changes -> done, 6 changes -> confirm', () => {
  // 5 creates -> done
  const fivePlan = {
    create: [
      { title: 'Task 1' },
      { title: 'Task 2' },
      { title: 'Task 3' },
      { title: 'Task 4' },
      { title: 'Task 5' },
    ],
    update: [],
    delete: [],
  };
  assert.equal(decideSafetyStatus(fivePlan), NoteStatus.DONE);

  // 6 creates -> confirm
  const sixPlan = {
    create: [
      ...fivePlan.create,
      { title: 'Task 6' },
    ],
    update: [],
    delete: [],
  };
  assert.equal(decideSafetyStatus(sixPlan), NoteStatus.CONFIRM);
});

test('T-NU-43 & C-026: Tie (ambiguous candidates) triggers confirm status', () => {
  const plan = {
    create: [],
    update: [{ ref: 'u1', task_id: 't4', done: true, label: 'Completed' }],
    delete: [],
  };
  const ambiguous = [
    { ref: 'u1', candidates: ['t4', 't5'], preselected: 't4' },
  ];

  const status = decideSafetyStatus(plan, [], ambiguous);
  assert.equal(status, NoteStatus.CONFIRM);
});

test('Zero changes with only already_done or not_found skips -> done status', () => {
  const plan = { create: [], update: [], delete: [] };
  const skipped1 = [{ text: 'done pay rent', reason: 'already_done' }];
  assert.equal(decideSafetyStatus(plan, skipped1), NoteStatus.DONE);

  const skipped2 = [{ text: 'delete homework', reason: 'not_found' }];
  assert.equal(decideSafetyStatus(plan, skipped2), NoteStatus.DONE);
});

test('Zero changes with plain skip (ideas/FYI/filler) -> followup status (C-013, C-014)', () => {
  const plan = { create: [], update: [], delete: [] };
  const skipped = [{ text: 'idea: dark mode', reason: 'skip' }];
  assert.equal(decideSafetyStatus(plan, skipped), NoteStatus.FOLLOWUP);
});

// --- Test T-NU-71: Plan Validation Drops Invalid Entries ---

test('T-NU-71: Plan validator drops invalid titles, unknown projects, invalid enums, and inverted time ranges', () => {
  const rawPlan = {
    create: [
      // Valid item
      { title: 'Valid task', priority: 'high', project_id: 'SQL Course', repeat: 'daily' },
      // Invalid: empty title
      { title: '', priority: 'low' },
      // Invalid: title > 200 chars
      { title: 'a'.repeat(201) },
      // Invalid priority
      { title: 'Invalid priority', priority: 'urgent_super' },
      // Unknown project -> project_id dropped to null (NU-E23)
      { title: 'Chemistry lab', project_id: 'Chemistry' },
      // End time not after start time -> end_time dropped
      { title: 'Meeting', start_time: '14:00', end_time: '13:00' },
    ],
    update: [
      { task_id: 't1', done: true },
      // Missing task_id
      { label: 'bad update' },
    ],
    delete: [
      { task_id: 't2' },
      // Missing task_id
      {},
    ],
  };

  const userContext = {
    userProjects: ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'],
    openTaskIds: new Set(['t1', 't2']),
  };

  const result = validatePlan(rawPlan, userContext);
  assert.equal(result.plan.create.length, 3); // Valid task, Chemistry lab (with null project), Meeting (with null end_time)
  assert.equal(result.plan.create[0].project_id, 'SQL Course');
  assert.equal(result.plan.create[1].project_id, null);
  assert.equal(result.plan.create[2].end_time, null);

  assert.equal(result.plan.update.length, 1);
  assert.equal(result.plan.delete.length, 1);
  assert.equal(result.dropped.length, 5); // 3 invalid creates + 1 bad update + 1 bad delete
});
