import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchCommand,
  extractMeaningfulWords,
  scoreTaskMatch,
} from '../src/index.js';

const context = {
  now: new Date('2026-10-23T08:12:00+07:00'),
  timezone: 'Asia/Ho_Chi_Minh',
};

// --- Tests T-NU-20 to T-NU-25 ---

test('T-NU-20 & C-016: "done email the group" matches open task with complete action', () => {
  const openTasks = [
    { id: 't1', title: 'Email the group', due_date: '2026-10-23' },
    { id: 't2', title: 'Buy printer ink', due_date: '2026-10-24' },
  ];

  const result = matchCommand('done email the group', 'complete', openTasks, [], context);
  assert.equal(result.matched, true);
  assert.equal(result.action, 'complete');
  assert.equal(result.targetTask.id, 't1');
  assert.equal(result.label, 'Completed');
});

test('T-NU-21 & C-017: "move gym membership to sunday" reschedules and computes "was" label', () => {
  const openTasks = [
    { id: 't2', title: 'Renew gym membership', due_date: '2026-10-23' },
  ];

  const result = matchCommand('move gym membership to sunday', 'reschedule', openTasks, [], context);
  assert.equal(result.matched, true);
  assert.equal(result.action, 'reschedule');
  assert.equal(result.targetTask.id, 't2');
  assert.equal(result.targetDetails.dueDate, '2026-10-25');
  assert.equal(result.label, 'Due Sun 25 Oct (was today)');
});

test('T-NU-22 & C-018: "delete old reading list" matches task for delete', () => {
  const openTasks = [
    { id: 't3', title: 'Old reading list' },
  ];

  const result = matchCommand('delete old reading list', 'delete', openTasks, [], context);
  assert.equal(result.matched, true);
  assert.equal(result.action, 'delete');
  assert.equal(result.targetTask.id, 't3');
  assert.equal(result.label, 'Old reading list');
});

test('T-NU-23: Overlap threshold 60% rule (59% no, 60% yes)', () => {
  // Command: "review chapter five summary notes" (5 words: review, chapter, five, summary, notes)
  const words = ['review', 'chapter', 'five', 'summary', 'notes'];

  // 2 of 5 words = 40% (< 60%) -> no match
  assert.ok(scoreTaskMatch(words, 'Review chapter') < 0.6);

  // 3 of 5 words = 60% (>= 60%) -> match!
  assert.ok(scoreTaskMatch(words, 'Review chapter five') >= 0.6);
});

test('T-NU-24: Done tasks are ignored during open matching', () => {
  const openTasks = [];
  const doneTasks = [
    { id: 't1', title: 'Email the group', done: true },
  ];

  const result = matchCommand('done email the group', 'complete', openTasks, doneTasks, context);
  // Matches done task -> skip already_done (NU-E12, C-027)
  assert.equal(result.matched, false);
  assert.equal(result.skipReason, 'already_done');
});

test('T-NU-25 & C-046, C-047, C-048: Vietnamese commands with diacritics', () => {
  // 1. "bài tập sql xong rồi"
  const openTasks = [
    { id: 't1', title: 'Bài tập SQL', due_date: '2026-10-23' },
    { id: 't2', title: 'Họp nhóm', due_date: '2026-10-24' },
  ];

  const r1 = matchCommand('bài tập sql xong rồi', 'complete', openTasks, [], context);
  assert.equal(r1.matched, true);
  assert.equal(r1.targetTask.id, 't1');

  // 2. "dời họp nhóm sang thứ 3"
  const r2 = matchCommand('dời họp nhóm sang thứ 3', 'reschedule', openTasks, [], context);
  assert.equal(r2.matched, true);
  assert.equal(r2.targetTask.id, 't2');
  assert.equal(r2.targetDetails.dueDate, '2026-10-27');
  assert.equal(r2.label, 'Due Tue 27 Oct (was tomorrow)');

  // 3. "xóa họp nhóm"
  const r3 = matchCommand('xóa họp nhóm', 'delete', openTasks, [], context);
  assert.equal(r3.matched, true);
  assert.equal(r3.targetTask.id, 't2');
});

test('NU-E11 & C-026: Tie detection when 2+ tasks have same top score', () => {
  const openTasks = [
    { id: 't4', title: 'Email Prof Lee', due_date: '2026-10-24' },
    { id: 't5', title: 'Email Prof Kim', due_date: '2026-10-26' },
  ];

  const result = matchCommand('done email prof', 'complete', openTasks, [], context);
  assert.equal(result.matched, true);
  assert.equal(result.isTie, true);
  assert.deepEqual(result.candidates, ['t4', 't5']);
  assert.equal(result.preselected, 't4'); // Soonest due date is preselected (NU-E11)
});

test('NU-E29 & C-028, C-029: No match handling', () => {
  // Complete without match -> skip not_found
  const r1 = matchCommand('delete chemistry homework', 'delete', [], [], context);
  assert.equal(r1.matched, false);
  assert.equal(r1.skipReason, 'not_found');

  // Reschedule without match -> create new task (C-029)
  const r2 = matchCommand('move dentist to friday', 'reschedule', [], [], context);
  assert.equal(r2.matched, false);
  assert.equal(r2.action, 'create_fallback');
  assert.equal(r2.task.title, 'Dentist');
  assert.equal(r2.task.dueDate, '2026-10-30');
});
