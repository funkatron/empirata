import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

test('held-out capture eval script runs on a manifest seed', () => {
  const script = resolve('scripts/held-out-capture-eval.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ROUNDS: '12',
      SEEDS: '104729',
      LAYOUTS: 'continents',
      AI_POLICY: 'classic-dos',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schema, 1);
  assert.equal(payload.reports.length, 1);
  assert.equal(payload.reports[0].seed, 104729);
});