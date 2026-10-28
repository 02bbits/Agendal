import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLowConfidenceItem,
  buildPlanJsonSchema,
  buildOpenRouterRequestBody,
  FallbackBudgetTracker,
  OpenRouterFallbackService,
  processNoteWithFallback,
} from '../src/index.js';

test('isLowConfidenceItem identifies low-confidence phrases per ADR-008 & NU-E40', () => {
  // Invalid date/time tokens
  assert.equal(isLowConfidenceItem('meeting at 3pmish'), true);
  assert.equal(isLowConfidenceItem('exam on 31/2'), true);

  // Unaccented Vietnamese with multiple keywords (NU-E40)
  assert.equal(isLowConfidenceItem('mua sua ngay mai'), true);

  // Normal accented Vietnamese is high confidence
  assert.equal(isLowConfidenceItem('mua sữa ngày mai'), false);

  // Normal English task is high confidence
  assert.equal(isLowConfidenceItem('Buy milk tomorrow 9am'), false);
});

test('SEC-41 & SEC-40: JSON Schema strictly constrains candidate task IDs to enum (Prompt injection defense)', () => {
  const candidateIds = ['task_101', 'task_102'];
  const schema = buildPlanJsonSchema(candidateIds, ['Personal', 'Work']);

  // Update & delete task_id must be constrained to candidate IDs
  assert.deepEqual(schema.properties.update.items.properties.task_id.enum, candidateIds);
  assert.deepEqual(schema.properties.delete.items.properties.task_id.enum, candidateIds);
  assert.equal(schema.additionalProperties, false);
});

test('SEC-43: Privacy and minimization controls in OpenRouter request', () => {
  const context = {
    clockContext: { now: new Date('2026-10-23T08:12:00Z'), timezone: 'Asia/Ho_Chi_Minh' },
    userProjects: ['SQL Course'],
    candidateTasks: [
      { id: 't1', title: 'Task 1', notes: 'SECRET USER NOTE DO NOT LEAK' },
      { id: 't2', title: 'Task 2' },
    ],
  };

  const body = buildOpenRouterRequestBody({
    lowConfidenceItems: ['mua sua ngay mai'],
    clockContext: context.clockContext,
    userProjects: context.userProjects,
    candidateTasks: context.candidateTasks,
    model: 'openai/gpt-4o-mini',
  });

  // 1. Data collection deny
  assert.equal(body.provider.data_collection, 'deny');
  assert.equal(body.provider.require_parameters, true);

  // 2. Strict temperature 0
  assert.equal(body.temperature, 0);

  // 3. Candidate tasks passed to LLM must NEVER include task notes or user metadata
  const userPrompt = JSON.parse(body.messages[1].content);
  assert.equal(userPrompt.candidate_tasks.length, 2);
  assert.equal(userPrompt.candidate_tasks[0].id, 't1');
  assert.equal(userPrompt.candidate_tasks[0].title, 'Task 1');
  assert.equal(userPrompt.candidate_tasks[0].notes, undefined); // Task notes never sent (SC-20)
  assert.equal(userPrompt.email, undefined);
  assert.equal(userPrompt.user_id, undefined);
});

test('SEC-42: Budget tracker limits per-user daily calls and global tokens', () => {
  const tracker = new FallbackBudgetTracker({ maxUserDailyCalls: 2, maxGlobalDailyTokens: 1000 });

  assert.equal(tracker.canMakeCall('user_1').allowed, true);
  tracker.recordUsage('user_1', 100);
  assert.equal(tracker.canMakeCall('user_1').allowed, true);
  tracker.recordUsage('user_1', 100);

  // Exceeded 2 calls
  const call3 = tracker.canMakeCall('user_1');
  assert.equal(call3.allowed, false);
  assert.equal(call3.reason, 'user_daily_limit_exceeded');

  // Another user can still call until global tokens exceeded
  assert.equal(tracker.canMakeCall('user_2').allowed, true);
  tracker.recordUsage('user_2', 900); // reaches 1100 total > 1000 limit

  const call4 = tracker.canMakeCall('user_2');
  assert.equal(call4.allowed, false);
  assert.equal(call4.reason, 'global_budget_exceeded');
});

test('SEC-44: Metadata-only logging records counts and durations, never free text', async () => {
  const loggedMetadata = [];
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ create: [], update: [], delete: [] }) } }],
      usage: { total_tokens: 42 },
    }),
  });

  const service = new OpenRouterFallbackService({
    enabled: true,
    fetchFn: mockFetch,
    logger: (meta) => loggedMetadata.push(meta),
  });

  await service.requestFallback({
    lowConfidenceItems: ['mua sua ngay mai'],
    clockContext: { now: new Date() },
    userId: 'u1',
  });

  assert.equal(loggedMetadata.length, 1);
  const log = loggedMetadata[0];
  assert.equal(log.status, 'success');
  assert.equal(log.itemCount, 1);
  assert.equal(log.tokensUsed, 42);
  assert.ok(typeof log.durationMs === 'number');
  assert.equal(log.text, undefined); // Never logs raw text
});

test('Resilience: Provider down / HTTP 500 gracefully falls back to rules mode (SEC-40, IM-38)', async () => {
  const mockFailingFetch = async () => ({
    ok: false,
    status: 500,
  });

  const service = new OpenRouterFallbackService({
    enabled: true,
    fetchFn: mockFailingFetch,
  });

  const input = {
    text: 'mua sua ngay mai',
    clientId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  };

  const result = await processNoteWithFallback(input, {}, service);
  // Falls back to rules
  assert.equal(result.note.engine, 'rules_fallback');
  assert.ok(result.note.name.length > 0);
});

test('Resilience: Request timeout aborts after deadline and returns rules_fallback', async () => {
  const mockHangingFetch = (_url, { signal }) =>
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const service = new OpenRouterFallbackService({
    enabled: true,
    timeoutMs: 30, // 30ms for fast test execution
    fetchFn: mockHangingFetch,
  });

  const input = {
    text: 'mua sua ngay mai',
    clientId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  };

  const result = await processNoteWithFallback(input, {}, service);
  assert.equal(result.note.engine, 'rules_fallback');
});

test('Recorded Stub: Successfully resolves low-confidence note in CI without network', async () => {
  const recordedPlan = {
    create: [
      {
        title: 'Mua sữa',
        due_date: '2026-10-24',
        start_time: null,
        end_time: null,
        priority: 'low',
        project_name: 'Personal',
        repeat: 'never',
        reminder: 'none',
      },
    ],
    update: [],
    delete: [],
  };

  const mockStubFetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(recordedPlan) } }],
      usage: { total_tokens: 58 },
    }),
  });

  const service = new OpenRouterFallbackService({
    enabled: true,
    fetchFn: mockStubFetch,
  });

  const input = {
    text: 'mua sua ngay mai',
    clientId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  };

  const result = await processNoteWithFallback(input, { userProjects: ['Personal'] }, service);
  assert.equal(result.note.engine, 'rules_llm');
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].task.title, 'Mua sữa');
  assert.equal(result.changes[0].task.due_date, '2026-10-24');
});
