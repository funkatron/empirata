import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicArmyConquestStep,
  getPlayerView,
  makeAiVsAiLab,
  playBlueOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('Classic army conquest step assaults an adjacent charted neutral city', () => {
  let g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
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
    position: { x: 10, y: 25 },
    order: { kind: 'none' },
    spent: 0,
    damage: 0,
    fuel: null,
    aboard: null,
  };
  g.units = [army];
  g.active = 'blue';
  updateAllKnowledge(g);
  const view = getPlayerView(g, 'blue');
  assert.deepEqual(classicArmyConquestStep(g, view, 'blue', army, 1), { x: 11, y: 25 });
});

test('Classic executor captures adjacent charted neutral city', () => {
  let g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
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
    position: { x: 10, y: 25 },
    order: { kind: 'none' },
    spent: 0,
    damage: 0,
    fuel: null,
    aboard: null,
  };
  g.units = [army];
  g.active = 'blue';
  updateAllKnowledge(g);
  g = playBlueOpponent(g);
  assert.equal(g.cities.find(c => c.id === 'neutral-1')?.owner, 'blue');
  assert.ok(g.events.some(e => e.message?.includes('captured')));
});