import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { runCorpus, ACCURACY_GATES } from '../src/corpus-runner.js';
import { OpenRouterFallbackService } from '../src/llm-fallback.js';

const seedPath = path.resolve('docs/06-testing/note-corpus/seed.yaml');
const seedYaml = fs.readFileSync(seedPath, 'utf8');
const seedCases = YAML.parse(seedYaml);

test('IM-39: Corpus runner passes all accuracy gates in rules mode over seed.yaml', async () => {
  assert.ok(seedCases.length >= 50, 'Corpus contains seed cases');

  const report = await runCorpus(seedCases, { mode: 'rules' });

  // Check all gates pass
  assert.equal(report.allPassed, true, 'All accuracy gates must pass in rules mode');

  // Verify specific rate thresholds per docs/06-testing/note-corpus/README.md
  assert.ok(report.rates.countsRate >= ACCURACY_GATES.counts, `Counts rate ${report.rates.countsRate} >= 0.95`);
  assert.ok(report.rates.dueDateRate >= ACCURACY_GATES.dueDate, `Due date rate ${report.rates.dueDateRate} >= 0.95`);
  assert.ok(report.rates.startTimeRate >= ACCURACY_GATES.startTime, `Start time rate ${report.rates.startTimeRate} >= 0.95`);
  assert.ok(report.rates.priorityRate >= ACCURACY_GATES.priority, `Priority rate ${report.rates.priorityRate} >= 0.90`);
  assert.ok(report.rates.projectRate >= ACCURACY_GATES.project, `Project rate ${report.rates.projectRate} >= 0.90`);
  assert.ok(report.rates.repeatRate >= ACCURACY_GATES.repeat, `Repeat rate ${report.rates.repeatRate} >= 0.90`);
  assert.ok(report.rates.reminderRate >= ACCURACY_GATES.reminder, `Reminder rate ${report.rates.reminderRate} >= 0.90`);
  assert.equal(report.rates.commandsRate, ACCURACY_GATES.commands, 'Commands rate must be 100%');
  assert.equal(report.rates.safetyStatusRate, ACCURACY_GATES.safetyStatus, 'Safety status rate must be 100%');
  assert.equal(report.rates.nameRate, ACCURACY_GATES.nameRules, 'Name rate must be 100% in rules mode');
});

test('IM-39: Corpus runner executes in LLM mode with recorded stub and meets gates', async () => {
  // Stub responding with empty creates/updates or valid plan
  const mockStubFetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ create: [], update: [], delete: [] }) } }],
      usage: { total_tokens: 30 },
    }),
  });

  const stubService = new OpenRouterFallbackService({
    enabled: true,
    fetchFn: mockStubFetch,
  });

  const report = await runCorpus(seedCases.slice(0, 15), { mode: 'llm', fallbackService: stubService });
  assert.ok(report.rates.countsRate >= 0.90);
  assert.ok(report.rates.safetyStatusRate >= 0.90);
});
