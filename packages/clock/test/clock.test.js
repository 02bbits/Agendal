import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeClock,
  SystemClock,
  formatLocalDate,
  formatLocalTime,
  computeRemindAtUtc,
  parseWallClockInTimezone,
} from '../src/index.js';

test('FakeClock initializes with pinned time and can format local dates', () => {
  // Pinned to Friday 23 Oct 2026, 08:12 Asia/Ho_Chi_Minh (+07:00)
  const clock = new FakeClock('2026-10-23T08:12:00+07:00');

  assert.equal(clock.today('Asia/Ho_Chi_Minh'), '2026-10-23');
  assert.equal(clock.time('Asia/Ho_Chi_Minh'), '08:12');

  // Same moment in UTC is 01:12
  assert.equal(clock.today('UTC'), '2026-10-23');
  assert.equal(clock.time('UTC'), '01:12');

  // Same moment in America/New_York (EDT, UTC-4) is Thursday 22 Oct 21:12
  assert.equal(clock.today('America/New_York'), '2026-10-22');
  assert.equal(clock.time('America/New_York'), '21:12');
});

test('FakeClock advances time accurately', () => {
  const clock = new FakeClock('2026-10-23T08:12:00+07:00');

  clock.advanceMinutes(48);
  assert.equal(clock.time('Asia/Ho_Chi_Minh'), '09:00');

  clock.advanceHours(15);
  // Reached midnight (24:00 -> 00:00 next day)
  assert.equal(clock.today('Asia/Ho_Chi_Minh'), '2026-10-24');
  assert.equal(clock.time('Asia/Ho_Chi_Minh'), '00:00');

  clock.advanceDays(2);
  assert.equal(clock.today('Asia/Ho_Chi_Minh'), '2026-10-26');
});

test('FakeClock allows setting time dynamically', () => {
  const clock = new FakeClock();
  clock.setTime('2026-12-31T23:59:00Z');

  assert.equal(clock.toISOString(), '2026-12-31T23:59:00.000Z');
  assert.equal(clock.today('UTC'), '2026-12-31');
  assert.equal(clock.time('UTC'), '23:59');

  // In Asia/Ho_Chi_Minh (+07:00), this is 2027-01-01 06:59
  assert.equal(clock.today('Asia/Ho_Chi_Minh'), '2027-01-01');
  assert.equal(clock.time('Asia/Ho_Chi_Minh'), '06:59');
});

test('parseWallClockInTimezone correctly converts floating wall time to UTC', () => {
  // 2026-10-26 09:00 in Asia/Ho_Chi_Minh (+07:00) -> 2026-10-26 02:00:00 UTC
  const utcDate = parseWallClockInTimezone('2026-10-26', '09:00', 'Asia/Ho_Chi_Minh');
  assert.equal(utcDate.toISOString(), '2026-10-26T02:00:00.000Z');

  // 2026-10-26 09:00 in America/New_York (EDT is UTC-4 in late Oct) -> 13:00:00 UTC
  const nyDate = parseWallClockInTimezone('2026-10-26', '09:00', 'America/New_York');
  assert.equal(nyDate.toISOString(), '2026-10-26T13:00:00.000Z');
});

test('computeRemindAtUtc conforms to ADR-006 rules', () => {
  // Test 1: Task with specific time (09:00) and 15m reminder in Asia/Ho_Chi_Minh
  // Wall time = 09:00 (02:00 UTC). 15 min before = 01:45 UTC
  const r1 = computeRemindAtUtc({
    dueDate: '2026-10-26',
    startTime: '09:00',
    reminder: '15m',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(r1, '2026-10-26T01:45:00.000Z');

  // Test 2: Task with no specific time -> default reference is 09:00 on due date
  // 1d before 09:00 on 2026-10-26 is 2026-10-25 09:00 (02:00 UTC)
  const r2 = computeRemindAtUtc({
    dueDate: '2026-10-26',
    startTime: null,
    reminder: '1d',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(r2, '2026-10-25T02:00:00.000Z');

  // Test 3: reminder = 'none' -> returns null
  const r3 = computeRemindAtUtc({
    dueDate: '2026-10-26',
    reminder: 'none',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(r3, null);

  // Test 4: 1h before 14:00 (starts at 13:00 wall time = 06:00 UTC)
  const r4 = computeRemindAtUtc({
    dueDate: '2026-10-26',
    startTime: '14:00',
    reminder: '1h',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(r4, '2026-10-26T06:00:00.000Z');
});

test('SystemClock satisfies Clock interface contract', () => {
  const clock = new SystemClock();
  const now = clock.now();
  assert.ok(now instanceof Date);
  assert.ok(!isNaN(now.getTime()));
  assert.match(clock.today('UTC'), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(clock.time('UTC'), /^\d{2}:\d{2}$/);
});
