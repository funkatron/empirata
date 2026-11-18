import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advanceLabRound,
  importSave,
  playBlueOpponent,
} from '../dist/engine/index.js';

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/islands-rim-round-376.json',
);

const SEA_KINDS = new Set(['destroyer', 'submarine', 'cruiser', 'battleship', 'transport', 'carrier']);

function eastRimNoneWarships(game) {
  return game.units.filter(
    u =>
      !u.aboard &&
      u.position.y === 1 &&
      u.position.x >= 92 &&
      u.order.kind === 'none' &&
      SEA_KINDS.has(u.kind),
  );
}

function loadIslandsFixture() {
  const game = importSave(readFileSync(fixturePath, 'utf8'));
  assert.equal(game.aiPolicy?.kind, 'classic-dos');
  assert.equal(game.scenario, 'ai-vs-ai');
  return game;
}

test('islands round-376 fixture: east rim none warships thin after classic lab rounds', () => {
  const start = loadIslandsFixture();
  const before = eastRimNoneWarships(start);
  assert.ok(before.length >= 3, `expected east rim pile in fixture, saw ${before.length}`);
  let game = start;
  for (let i = 0; i < 8; i++) {
    game = advanceLabRound(game);
  }
  const after = eastRimNoneWarships(game);
  assert.ok(
    after.length < before.length,
    `east rim none warships should decrease (${before.length} -> ${after.length})`,
  );
});

test('islands round-376 fixture: sampled rim unit moves on classic activation', () => {
  const start = loadIslandsFixture();
  const sample = start.units.find(u => u.id === 'u4' && u.position.y === 1);
  assert.ok(sample, 'fixture unit u4 on top rim');
  let game = structuredClone(start);
  game.active = 'blue';
  const before = { ...sample.position };
  game = playBlueOpponent(game);
  const moved = game.units.find(u => u.id === 'u4');
  assert.ok(moved);
  const changed =
    moved.position.x !== before.x ||
    moved.position.y !== before.y ||
    moved.order.kind === 'go-direction';
  assert.ok(changed, 'rim unit should move or adopt go-direction bearing');
});