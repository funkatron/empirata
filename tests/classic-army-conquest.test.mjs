import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicArmyConquestStep,
  classicKnownHostileCityTiles,
  getPlayerView,
  makeAiVsAiLab,
  playBlueOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicKnownHostileCityTiles includes charted neutral and enemy cities only', () => {
  let g = makeAiVsAiLab();
  g.cities.push(
    {
      id: 'neutral-1',
      position: { x: 11, y: 25 },
      owner: null,
      production: null,
      progress: 0,
      firstCycle: true,
    },
    {
      id: 'red-outpost',
      position: { x: 9, y: 25 },
      owner: 'red',
      production: 'army',
      progress: 0,
      firstCycle: true,
    },
  );
  g.units = [
    {
      id: 'u-blue-army',
      owner: 'blue',
      kind: 'army',
      position: { x: 10, y: 25 },
      order: { kind: 'none' },
      spent: 0,
      damage: 0,
      aboard: null,
    },
  ];
  g.active = 'blue';
  updateAllKnowledge(g);
  const view = getPlayerView(g, 'blue');
  const hostile = classicKnownHostileCityTiles(view);
  assert.equal(hostile.length, 2);
  assert.ok(hostile.some(p => p.x === 11 && p.y === 25));
  assert.ok(hostile.some(p => p.x === 9 && p.y === 25));
  const blueHome = g.cities.find(c => c.owner === 'blue');
  assert.ok(blueHome && !hostile.some(p => p.x === blueHome.position.x && p.y === blueHome.position.y));
});

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

test('Classic executor attacks an adjacent charted neutral (unowned) city', () => {
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
  // `12C2:115F` steps into the adjacent non-own city; the outcome is a combat roll.
  const captured = g.cities.find(c => c.id === 'neutral-1')?.owner === 'blue';
  const lost = g.events.some(e => e.message?.includes('lost attacking neutral-1'));
  assert.ok(captured || lost);
});

test('Classic army conquest step assaults an adjacent charted enemy city', () => {
  let g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.cities.push({
    id: 'red-outpost',
    position: { x: 11, y: 25 },
    owner: 'red',
    production: 'army',
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

test('Classic executor assaults an adjacent charted enemy city', () => {
  let g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.cities.push({
    id: 'red-outpost',
    position: { x: 11, y: 25 },
    owner: 'red',
    production: 'army',
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
  const before = g.nextEventId;
  updateAllKnowledge(g);
  g = playBlueOpponent(g);
  const assault = g.events.filter(e => e.id >= before);
  assert.ok(
    assault.some(e => e.kind === 'combat' || e.message?.includes('assault') || e.message?.includes('captured')),
    'expected city assault resolution against enemy owner',
  );
});