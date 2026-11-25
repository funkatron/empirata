import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN, ROUNDS, SEED, runGolden } from './golden-parity.mjs';

// Parity gate for performance PRs: see tests/golden-parity.mjs.
for (const layout of ['continents', 'islands']) {
  test(`golden parity: classic ${layout}, seed ${SEED}, ${ROUNDS} rounds`, () => {
    assert.deepEqual(runGolden('classic', layout), GOLDEN.classic[layout]);
  });
}
