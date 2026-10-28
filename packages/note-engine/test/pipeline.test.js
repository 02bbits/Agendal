import test from 'node:test';
import assert from 'node:assert/strict';
import { processNote, generateNoteName } from '../src/index.js';

const context = {
  userProjects: ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'],
  clockContext: {
    now: new Date('2026-10-23T08:12:00+07:00'),
    timezone: 'Asia/Ho_Chi_Minh',
  },
};

// --- Tests T-NU-50 to T-NU-51 (Naming rules) ---

test('T-NU-50: Note naming matches rules table', () => {
  // 1. One task -> title
  const n1 = generateNoteName({ create: [{ title: 'Call mum' }], update: [], delete: [] });
  assert.equal(n1, 'Call mum');

  // 2. One change -> "Update: " + title
  const n2 = generateNoteName({ create: [], update: [{ label: 'Renew gym membership' }], delete: [] });
  assert.equal(n2, 'Update: Renew gym membership');

  // 3. Only changes -> "Updates to N tasks"
  const n3 = generateNoteName({ create: [], update: [{}, {}], delete: [{}] });
  assert.equal(n3, 'Updates to 3 tasks');

  // 4. All tasks in one project -> Project + " to-dos"
  const n4 = generateNoteName({
    create: [{ title: 'SQL HW', project_id: 'SQL Course' }, { title: 'SQL Read', project_id: 'SQL Course' }],
    update: [],
    delete: [],
  });
  assert.equal(n4, 'SQL Course to-dos');

  // 5. All tasks due tomorrow -> "Tomorrow's plan"
  const n5 = generateNoteName({
    create: [{ title: 'A', due_date: '2026-10-24' }, { title: 'B', due_date: '2026-10-24' }],
    update: [],
    delete: [],
  });
  assert.equal(n5, "Tomorrow's plan");

  // 6. Multiple tasks within 7 days -> "This week"
  const n6 = generateNoteName({
    create: [{ title: 'A', due_date: '2026-10-24' }, { title: 'B', due_date: '2026-10-26' }],
    update: [],
    delete: [],
  });
  assert.equal(n6, 'This week');

  // 7. Anything else -> first title + " + N more"
  const n7 = generateNoteName({
    create: [{ title: 'Buy milk' }, { title: 'Print CV' }, { title: 'Book dentist' }],
    update: [],
    delete: [],
  });
  assert.equal(n7, 'Buy milk + 2 more');

  // 8. Nothing actionable -> First words (up to 6)
  const n8 = generateNoteName({ create: [], update: [], delete: [] }, [], 'idea: dark mode for portfolio site');
  assert.equal(n8, 'Idea: dark mode for portfolio site');
});

test('T-NU-51: Names over 34 characters cut at word boundary with ellipsis', () => {
  const longTitle = 'Organize the university wide department research symposium';
  const name = generateNoteName({ create: [{ title: longTitle }], update: [], delete: [] });
  assert.ok(name.length <= 34);
  assert.ok(name.endsWith('…'));
});

// --- Pipeline Integration Tests (T-NU-60, T-NU-70) ---

test('T-NU-70: Pipeline is deterministic in rules mode', () => {
  const input = {
    text: 'sql quiz monday 9am, email the group tonight, buy printer ink tomorrow',
    clientId: '8f1c2b3a-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    writtenAt: '2026-10-23T08:12:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  const res1 = processNote(input, context);
  const res2 = processNote(input, context);

  assert.equal(res1.note.status, 'done');
  assert.equal(res1.note.name, 'This week');
  assert.equal(res1.changes.length, 3);
  assert.equal(res1.changes[0].task.title, res2.changes[0].task.title);
  assert.equal(res1.changes[0].task.due_date, res2.changes[0].task.due_date);
  assert.equal(res1.changes[0].task.priority, res2.changes[0].task.priority);
});

test('Pipeline handles confirm plan with ambiguous candidates (C-026)', () => {
  const input = {
    text: 'done email prof',
    clientId: '8f1c2b3a-4d5e-6f7a-8b9c-0d1e2f3a4b5d',
    writtenAt: '2026-10-23T08:12:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  const userContext = {
    ...context,
    openTasks: [
      { id: 't4', title: 'Email Prof Lee', due_date: '2026-10-24' },
      { id: 't5', title: 'Email Prof Kim', due_date: '2026-10-26' },
    ],
  };

  const result = processNote(input, userContext);
  assert.equal(result.note.status, 'confirm');
  assert.equal(result.changes.length, 0);
  assert.ok(result.plan !== null);
  assert.equal(result.ambiguous.length, 1);
  assert.deepEqual(result.ambiguous[0].candidates, ['t4', 't5']);
});

test('Pipeline handles followup for non-actionable notes (C-013)', () => {
  const input = {
    text: 'idea: dark mode for portfolio site',
    clientId: '8f1c2b3a-4d5e-6f7a-8b9c-0d1e2f3a4b5e',
    writtenAt: '2026-10-23T08:12:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  const result = processNote(input, context);
  assert.equal(result.note.status, 'followup');
  assert.equal(result.changes.length, 0);
  assert.equal(result.plan, null);
  assert.equal(result.skipped.length, 1);
});
