import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSchema, loadFixture } from '../src/index.js';

test('loadSchema loads valid note-result.schema.json', () => {
  const schema = loadSchema('note-result.schema.json');
  assert.equal(schema.$id, 'https://agendal.app/schemas/note-result.schema.json');
  assert.equal(schema.type, 'object');
});

test('note-result-done fixture matches contract specifications', () => {
  const doneFixture = loadFixture('note-result-done.json');
  assert.equal(doneFixture.note.status, 'done');
  assert.ok(Array.isArray(doneFixture.changes));
  assert.equal(doneFixture.changes.length, 2);
  assert.equal(doneFixture.plan, null);
  assert.equal(doneFixture.skipped.length, 1);
  assert.deepEqual(doneFixture.ambiguous, []);
});

test('note-result-confirm fixture matches contract specifications', () => {
  const confirmFixture = loadFixture('note-result-confirm.json');
  assert.equal(confirmFixture.note.status, 'confirm');
  assert.deepEqual(confirmFixture.changes, []);
  assert.ok(confirmFixture.plan !== null);
  assert.ok(Array.isArray(confirmFixture.plan.create));
  assert.ok(Array.isArray(confirmFixture.plan.update));
  assert.ok(Array.isArray(confirmFixture.plan.delete));
  assert.equal(confirmFixture.plan.delete.length, 1);
  assert.equal(confirmFixture.ambiguous.length, 1);
});

test('note-result-followup fixture matches contract specifications', () => {
  const followupFixture = loadFixture('note-result-followup.json');
  assert.equal(followupFixture.note.status, 'followup');
  assert.deepEqual(followupFixture.changes, []);
  assert.equal(followupFixture.plan, null);
  assert.equal(followupFixture.skipped.length, 1);
  assert.equal(followupFixture.skipped[0].reason, 'skip');
});
