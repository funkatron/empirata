import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRulesLab, endTurn, playRedOpponent, exportSave, importSave } from '../dist/engine/index.js';

test('Legacy saves without aiPolicy still run the modern opponent', () => {
  const before = makeRulesLab();
  before.active = 'red';
  before.round = 2;
  const after = playRedOpponent(structuredClone(before));
  assert.notDeepEqual(after.units, before.units, 'modern AI should mutate unit positions on red turn');
});

test('Classic DOS policy routes to the classic executor without modern production heuristics', () => {
  const before = endTurn(makeRulesLab());
  before.aiPolicy = { kind: 'classic-dos', grade: 1 };
  const after = playRedOpponent(structuredClone(before));
  assert.equal(after.cities.find(c => c.id === 'c-red').production, before.cities.find(c => c.id === 'c-red').production);
  assert.ok(after.events.some(e => e.kind === 'system' && e.message.includes('ALG-AI-001')));
  assert.deepEqual(playRedOpponent(importSave(exportSave(before))), after);
});

test('Modern experimental policy is explicit but unchanged', () => {
  const game = makeRulesLab();
  game.active = 'red';
  game.aiPolicy = { kind: 'modern-experimental' };
  const implicit = playRedOpponent(structuredClone({ ...game, aiPolicy: undefined }));
  const explicit = playRedOpponent(structuredClone(game));
  assert.notDeepEqual(implicit.units, game.units);
  assert.notDeepEqual(explicit.units, game.units);
});