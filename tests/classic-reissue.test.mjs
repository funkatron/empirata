import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicArmyActivation,
  classicArmyCityTaskTurn,
  classicTacticalReissueOrder,
  getPlayerView,
  makeAiVsAiLab,
  setOrder,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicTacticalReissueOrder leaves armies to the DOS army reissue 0x1F238', () => {
  let g = makeAiVsAiLab();
  g.cities.push({
    id: 'neutral-1',
    position: { x: 11, y: 25 },
    owner: null,
    production: null,
    progress: 0,
    firstCycle: true,
  });
  const army = {
    id: 'u-blue-army',
    owner: 'blue',
    kind: 'army',
    position: { x: 8, y: 25 },
    order: { kind: 'none' },
    spent: 0,
    damage: 0,
    aboard: null,
  };
  g.units = [army, { ...army, id: 'scout', position: { x: 11, y: 25 }, aboard: null }];
  g.active = 'blue';
  updateAllKnowledge(g);
  g.units = [army];
  updateAllKnowledge(g);
  const view = getPlayerView(g, 'blue');
  assert.equal(classicTacticalReissueOrder(g, view, 'blue', army), null);
});

test('classic army city task (0x1F454) stores move-to on a parity turn and keeps it', () => {
  let g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.cities.push({
    id: 'neutral-1',
    position: { x: 20, y: 25 },
    owner: null,
    production: null,
    progress: 0,
    firstCycle: true,
  });
  const army = {
    id: 'u-blue-army',
    owner: 'blue',
    kind: 'army',
    position: { x: 10, y: 25 },
    order: { kind: 'random' },
    spent: 0,
    damage: 0,
    aboard: null,
  };
  g.units = [army, { ...army, id: 'scout', position: { x: 20, y: 25 }, aboard: null }];
  g.active = 'blue';
  updateAllKnowledge(g);
  g.units = [army];
  updateAllKnowledge(g);
  g = setOrder(g, 'u-blue-army', { kind: 'none' });
  const before = g.units.find(u => u.id === 'u-blue-army').order;
  assert.equal(before.kind, 'none');
  // Pick a round whose parity bit runs the city task for this unit.
  if (!classicArmyCityTaskTurn(g, g.units[0])) g.round += 1;
  const act = classicArmyActivation(g, 'blue', 'u-blue-army', 1, (gg, o) => setOrder(gg, "u-blue-army", o, true), () => null);
  assert.deepEqual(act.game.units[0].order, { kind: 'move-to', destination: { x: 20, y: 25 } });
  // One step closer along the land path (tie-break of `0x4714` is untraced).
  assert.equal(Math.max(Math.abs(act.step.x - 20), Math.abs(act.step.y - 25)), 9);
  // Next activation: order 0xF still active (not captured, reachable), no new rand draw.
  const draws = act.game.rng.draws;
  const again = classicArmyActivation(act.game, 'blue', 'u-blue-army', 1, (gg, o) => setOrder(gg, "u-blue-army", o, true), () => null);
  assert.equal(again.game.rng.draws, draws);
  assert.equal(again.game.units[0].order.kind, 'move-to');
});