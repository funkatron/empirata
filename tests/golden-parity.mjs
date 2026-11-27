// Shared golden-parity runner (not a test file itself).
//
// Performance work must not change gameplay: the same seed and rounds must give the
// same save bytes and the same number of RNG draws (docs/PERFORMANCE_AI_INTEGRATION.md).
// If a PR changes gameplay on purpose, update GOLDEN below in that PR and say why.
import { createHash } from 'node:crypto';
import * as engine from '../dist/engine/index.js';
import { makeCampaign } from '../scripts/campaign-maps.mjs';

export const ROUNDS = 150;
export const SEED = 17;

const POLICIES = {
  classic: { kind: 'classic-dos', grade: 1 },
  modern: { kind: 'modern-experimental' },
};

/** First 16 hex digits of SHA-256(exportSave) and rng.draws after ROUNDS rounds (v0.6.20). */
export const GOLDEN = {
  classic: {
    // v0.7.3: classic army activation (0x1F238 / 0x1F454 / 0x1F376) replaces the
    // BFS-to-any-hostile-city step; one rand per city task and wander heading.
    // v0.7.6: army transport boarding 0x1F6AA draws one rand per activation that reaches it.
    continents: { hash: '590d6b63259096c2', draws: 19117 },
    islands: { hash: '33f4dbe7c8adb477', draws: 398 },
  },
  modern: {
    continents: { hash: 'f9e6126b9092f628', draws: 88 },
    islands: { hash: '0013ed01ab048f73', draws: 29 },
  },
};

export function runGolden(policy, layout) {
  let g = makeCampaign(engine, layout, SEED, { aiPolicy: POLICIES[policy], density: 'standard' });
  for (let r = 0; r < ROUNDS; r++) g = engine.advanceLabRound(g);
  return {
    hash: createHash('sha256').update(engine.exportSave(g)).digest('hex').slice(0, 16),
    draws: g.rng.draws,
  };
}
