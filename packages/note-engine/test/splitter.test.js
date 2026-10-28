import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitNote,
  normalizeNoteText,
  stripLineBullets,
  NoteSplitError,
} from '../src/index.js';

// --- Normalization & Constraints ---
test('normalizeNoteText handles NFC, zero-width chars, control characters, and line breaks', () => {
  const raw = '\uFEFFbuy milk\r\n\u200Bread chapter 1\x07';
  const normalized = normalizeNoteText(raw);
  assert.equal(normalized, 'buy milk\nread chapter 1');
});

test('splitNote throws note.empty on whitespace or zero-width only strings', () => {
  assert.throws(() => splitNote('   \n\t\u200B  '), (err) => err.code === 'note.empty');
});

test('splitNote throws note.too_long when exceeding 5,000 characters', () => {
  const longText = 'buy milk. '.repeat(600);
  assert.throws(() => splitNote(longText), (err) => err.code === 'note.too_long');
});

test('splitNote throws note.too_many_items when more than 30 items after merging (T-NU-114, C-030)', () => {
  const note = 'a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31';
  assert.throws(() => splitNote(note), (err) => err.code === 'note.too_many_items');
});

// --- Splitting Tests (T-NU-01 to T-NU-07) ---

test('T-NU-01: Split on newline', () => {
  const note = 'buy milk\ncall mum\nclean room';
  const items = splitNote(note);
  assert.deepEqual(items, ['buy milk', 'call mum', 'clean room']);
});

test('T-NU-02: Split on comma when not merging', () => {
  // 'dentist, haircut' has no initial task verb, so it splits
  const note = 'dentist, haircut';
  const items = splitNote(note);
  assert.deepEqual(items, ['dentist', 'haircut']);
});

test('T-NU-03: Split on semicolon', () => {
  const note = 'study for exam; wash car; feed cat';
  const items = splitNote(note);
  assert.deepEqual(items, ['study for exam', 'wash car', 'feed cat']);
});

test('T-NU-04: Split on full stop (period)', () => {
  const note = 'finish slides. send email. rest';
  const items = splitNote(note);
  assert.deepEqual(items, ['finish slides', 'send email', 'rest']);
});

test('T-NU-05: Split on whole-word then', () => {
  const note = 'finish slides then send them to the group';
  const items = splitNote(note);
  assert.deepEqual(items, ['finish slides', 'send them to the group']);
});

test('T-NU-06 & T-NU-120: Strip bullets, numbering, and checkboxes at line start', () => {
  const note = '- buy milk\n* print CV\n1. book dentist\n[ ] pay rent\n• call bank';
  const items = splitNote(note);
  assert.deepEqual(items, ['buy milk', 'print CV', 'book dentist', 'pay rent', 'call bank']);
});

test('T-NU-07: One task per actionable item', () => {
  const note = 'sql quiz monday 9am, email the group tonight, buy printer ink tomorrow';
  const items = splitNote(note);
  assert.deepEqual(items, [
    'sql quiz monday 9am',
    'email the group tonight',
    'buy printer ink tomorrow',
  ]);
});

// --- Edge Cases (NU-E17 to NU-E41) ---

test('NU-E17: "then" inside a word does not split', () => {
  const note = 'fly to athens tomorrow';
  const items = splitNote(note);
  assert.deepEqual(items, ['fly to athens tomorrow']);
});

test('NU-E18: Comma between digits does not split', () => {
  const note = 'write 1,000 word essay by sunday';
  const items = splitNote(note);
  assert.deepEqual(items, ['write 1,000 word essay by sunday']);
});

test('NU-E19: Dots in numbers, abbreviations, and filenames do not split', () => {
  const note = 'standup 9.30 tomorrow. check report.pdf with Dr. Lee';
  const items = splitNote(note);
  assert.deepEqual(items, ['standup 9.30 tomorrow', 'check report.pdf with Dr. Lee']);
});

test('NU-E33: Comma list after task verb merges into single task', () => {
  const note = 'buy milk, eggs and bread';
  const items = splitNote(note);
  assert.deepEqual(items, ['buy milk, eggs and bread']);
});

test('NU-E33 & C-043: Comma split when subsequent fragment has date/keyword signal', () => {
  const note = 'buy ink, sql quiz monday';
  const items = splitNote(note);
  assert.deepEqual(items, ['buy ink', 'sql quiz monday']);
});

test('NU-E41: Vietnamese "rồi" at end does not split; splits only when followed by words', () => {
  // At end: complete command (NU-E41)
  const note1 = 'bài tập sql xong rồi';
  const items1 = splitNote(note1);
  assert.deepEqual(items1, ['bài tập sql xong rồi']);

  // Followed by words: splits
  const note2 = 'chạy bộ mỗi ngày 6h rồi đi chợ chiều nay';
  const items2 = splitNote(note2);
  assert.deepEqual(items2, ['chạy bộ mỗi ngày 6h', 'đi chợ chiều nay']);

  // "sau đó" followed by words: splits
  const note3 = 'học bài sau đó đi ngủ';
  const items3 = splitNote(note3);
  assert.deepEqual(items3, ['học bài', 'đi ngủ']);
});
