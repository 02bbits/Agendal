import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyItem,
  ItemType,
  splitNote,
  extractTaskItem,
} from '../src/index.js';

// --- Tests T-NU-30 to T-NU-33 ---

test('T-NU-30 & C-013, C-049: Skip prefixes (idea, note, thought, fyi, remember that, ý tưởng, ghi chú)', () => {
  const r1 = classifyItem('idea: dark mode for portfolio site');
  assert.equal(r1.type, ItemType.SKIP);
  assert.equal(r1.reason, 'skip');

  const r2 = classifyItem('fyi lab moved to room 3');
  assert.equal(r2.type, ItemType.SKIP);
  assert.equal(r2.reason, 'skip');

  const r3 = classifyItem('remember that keys are under the mat');
  assert.equal(r3.type, ItemType.SKIP);
  assert.equal(r3.reason, 'skip');

  // Vietnamese prefix
  const r4 = classifyItem('ý tưởng: làm app học từ vựng');
  assert.equal(r4.type, ItemType.SKIP);
  assert.equal(r4.reason, 'skip');

  const r5 = classifyItem('ghi chú: họp phòng 402');
  assert.equal(r5.type, ItemType.SKIP);
  assert.equal(r5.reason, 'skip');
});

test('T-NU-31 & C-014: Filler words classified as skip', () => {
  assert.equal(classifyItem('ok thanks').type, ItemType.SKIP);
  assert.equal(classifyItem('hmm').type, ItemType.SKIP);
  assert.equal(classifyItem('okay').type, ItemType.SKIP);
  assert.equal(classifyItem('test').type, ItemType.SKIP);
  assert.equal(classifyItem('cool').type, ItemType.SKIP);
  assert.equal(classifyItem('lol').type, ItemType.SKIP);
  assert.equal(classifyItem('ừm').type, ItemType.SKIP);
  assert.equal(classifyItem('cảm ơn').type, ItemType.SKIP);
});

test('T-NU-32 & C-015: Non-task items preserved in skipped array alongside task items', () => {
  const note = 'fyi lab moved to room 3. buy printer ink';
  const items = splitNote(note);
  assert.equal(items.length, 2);

  const classified = items.map(classifyItem);
  assert.equal(classified[0].type, ItemType.SKIP);
  assert.equal(classified[1].type, ItemType.TASK);
});

test('Special Rule: "remember to" is a task lead-in, while "remember that" is a skip', () => {
  const taskItem = classifyItem('remember to email the lecturer tonight');
  assert.equal(taskItem.type, ItemType.TASK);

  const skipItem = classifyItem('remember that submission closes at noon');
  assert.equal(skipItem.type, ItemType.SKIP);
});

test('Command vs Task classification rules', () => {
  // Complete command
  assert.equal(classifyItem('done email the group').type, ItemType.COMMAND);
  assert.equal(classifyItem('bài tập sql xong rồi').type, ItemType.COMMAND);

  // Reschedule command (with "to <when>")
  const moveCmd = classifyItem('move gym membership to sunday');
  assert.equal(moveCmd.type, ItemType.COMMAND);
  assert.equal(moveCmd.commandType, 'reschedule');

  // Move without "to <when>" is a task (§2.3)
  const moveTask = classifyItem('move the heavy table');
  assert.equal(moveTask.type, ItemType.TASK);

  // Delete command
  assert.equal(classifyItem('delete old reading list').type, ItemType.COMMAND);
  assert.equal(classifyItem('xóa họp nhóm').type, ItemType.COMMAND);
});

test('NU-E32: Items with no title words after extraction become skip', () => {
  const extracted = extractTaskItem('tomorrow 9am', {
    now: new Date('2026-10-23T08:12:00+07:00'),
  });
  assert.equal(extracted.isSkip, true);
  assert.equal(extracted.reason, 'skip');
});
