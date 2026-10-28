#!/usr/bin/env node

/**
 * CLI Runner for Golden Note Corpus (IM-39, docs/06-testing/note-corpus/README.md)
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { runCorpus } from '../src/corpus-runner.js';

const modeArg = process.argv.includes('--llm') ? 'llm' : 'rules';
const fileArgIndex = process.argv.indexOf('--file');
const filePath = fileArgIndex !== -1 && process.argv[fileArgIndex + 1]
  ? path.resolve(process.argv[fileArgIndex + 1])
  : path.resolve('docs/06-testing/note-corpus/seed.yaml');

console.log(`\n======================================================`);
console.log(`  Agendal Note Understanding — Golden Corpus Runner  `);
console.log(`  Mode: ${modeArg.toUpperCase()} | File: ${path.relative(process.cwd(), filePath)}`);
console.log(`======================================================\n`);

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const cases = YAML.parse(content);

console.log(`Loaded ${cases.length} corpus cases. Running evaluation...\n`);

const report = await runCorpus(cases, { mode: modeArg });

console.log('--- Accuracy Gate Results ---');
for (const [gateName, passed] of Object.entries(report.gates)) {
  const rateVal = (report.rates[`${gateName}Rate`] * 100).toFixed(1);
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${statusIcon}  ${gateName.padEnd(14)}: ${rateVal}%`);
}

console.log('\n-----------------------------');
if (report.allPassed) {
  console.log(`🎉 ALL ACCURACY GATES PASSED! (${cases.length}/${cases.length} cases evaluated successfully)`);
  process.exit(0);
} else {
  console.error(`💥 ACCURACY GATES FAILED!`);
  const failed = report.results.filter(r => !r.statusOk || !r.nameOk || !r.countsOk || !r.commandOk);
  console.log(`Failed cases (${failed.length}):`);
  for (const f of failed.slice(0, 10)) {
    console.log(`  Case ${f.id}: statusOk=${f.statusOk}, nameOk=${f.nameOk}, countsOk=${f.countsOk}, commandOk=${f.commandOk}`);
  }
  process.exit(1);
}
