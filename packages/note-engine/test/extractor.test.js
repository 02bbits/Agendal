import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTaskItem } from '../src/index.js';

const context = {
  now: new Date('2026-10-23T08:12:00+07:00'), // Friday
  timezone: 'Asia/Ho_Chi_Minh',
  userProjects: ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'],
  weekStart: 'monday',
};

// --- Tests T-NU-10 to T-NU-18 ---

test('T-NU-10 & C-001: Extract date, time, priority, project, reminder for quiz', () => {
  const result = extractTaskItem('sql quiz monday 9am', context);
  assert.equal(result.title, 'SQL quiz');
  assert.equal(result.dueDate, '2026-10-26');
  assert.equal(result.startTime, '09:00');
  assert.equal(result.priority, 'high');
  assert.equal(result.project, 'SQL Course');
  assert.equal(result.reminder, '1d'); // exam/quiz -> 1d
});

test('T-NU-11: Time extraction with am/pm, 24h, and time words', () => {
  // 6:30pm -> 18:30
  const r1 = extractTaskItem('call doctor at 6:30pm', context);
  assert.equal(r1.startTime, '18:30');

  // 14:00
  const r2 = extractTaskItem('meeting at 14:00', context);
  assert.equal(r2.startTime, '14:00');

  // tonight at 20:00
  const r3 = extractTaskItem('email the group tonight', context);
  assert.equal(r3.dueDate, '2026-10-23');
  assert.equal(r3.startTime, '20:00');
  assert.equal(r3.reminder, '15m');
});

test('T-NU-12: Priority rules (High content words, defaults)', () => {
  // Content word 'deadline' -> high
  const r1 = extractTaskItem('submit tax form deadline', context);
  assert.equal(r1.priority, 'high');

  // Default for today -> medium
  const r2 = extractTaskItem('call mum today', context);
  assert.equal(r2.priority, 'medium');

  // Default for other days -> low
  const r3 = extractTaskItem('buy milk tomorrow', context);
  assert.equal(r3.priority, 'low');

  // Pure low priority word
  const r4 = extractTaskItem('clean desk whenever', context);
  assert.equal(r4.priority, 'low');
  assert.equal(r4.title, 'Clean desk');
});

test('T-NU-13: Project matching (literal name and keywords)', () => {
  // Keyword 'gym' -> Personal
  const r1 = extractTaskItem('gym tomorrow', context);
  assert.equal(r1.project, 'Personal');

  // Literal project name 'HCI'
  const r2 = extractTaskItem('submit HCI report by friday', context);
  assert.equal(r2.project, 'HCI');
});

test('T-NU-14 & C-004: Repeat daily, weekly, monthly', () => {
  const r1 = extractTaskItem('gym every monday 7am', context);
  assert.equal(r1.repeat, 'weekly');
  assert.equal(r1.dueDate, '2026-10-26');
  assert.equal(r1.startTime, '07:00');

  const r2 = extractTaskItem('stretch every day 21:00', context);
  assert.equal(r2.repeat, 'daily');
  assert.equal(r2.dueDate, '2026-10-23');
});

test('T-NU-16: Acronym casing and sentence-case title', () => {
  const r1 = extractTaskItem('print cv for job fair', context);
  assert.equal(r1.title, 'Print CV for job fair');

  const r2 = extractTaskItem('update api docs', context);
  assert.equal(r2.title, 'Update API docs');
});

test('T-NU-17: Empty fields stay empty/default', () => {
  const r = extractTaskItem('read chapter 1', context);
  assert.equal(r.title, 'Read chapter 1');
  assert.equal(r.dueDate, null);
  assert.equal(r.startTime, null);
  assert.equal(r.project, null);
  assert.equal(r.repeat, 'never');
  assert.equal(r.reminder, 'none');
  assert.equal(r.priority, 'low');
});

// --- Vietnamese Extraction Tests (T-NU-18, C-044, C-045, C-051) ---

test('T-NU-18 & C-044: Vietnamese relative date, time and weekday', () => {
  const r1 = extractTaskItem('mai 9h họp nhóm', context);
  assert.equal(r1.title, 'Họp nhóm');
  assert.equal(r1.dueDate, '2026-10-24');
  assert.equal(r1.startTime, '09:00');
  assert.equal(r1.reminder, '15m');

  const r2 = extractTaskItem('nộp báo cáo HCI thứ 2', context);
  assert.equal(r2.title, 'Nộp báo cáo HCI');
  assert.equal(r2.dueDate, '2026-10-26');
  assert.equal(r2.priority, 'high');
  assert.equal(r2.project, 'HCI');
});

test('T-NU-18 & C-045: Vietnamese kiểm tra SQL with 2 giờ chiều', () => {
  const r = extractTaskItem('kiểm tra SQL thứ 2 lúc 2 giờ chiều', context);
  assert.equal(r.title, 'Kiểm tra SQL');
  assert.equal(r.dueDate, '2026-10-26');
  assert.equal(r.startTime, '14:00');
  assert.equal(r.priority, 'high');
  assert.equal(r.project, 'SQL Course');
  assert.equal(r.reminder, '1d');
});

test('T-NU-110: "next week" / "tuần sau" first day per weekStart', () => {
  const r = extractTaskItem('review budget next week', context);
  // Friday 23 Oct -> next Monday is 26 Oct
  assert.equal(r.dueDate, '2026-10-26');
});
