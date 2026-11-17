import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicTacticalReissueOrder,
  getPlayerView,
  makeAiVsAiLab,
  setOrder,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicTacticalReissueOrder assigns move-to toward nearest charted neutral', () => {
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
  assert.deepEqual(classicTacticalReissueOrder(g, view, 'blue', army), {
    kind: 'move-to',
    destination: { x: 11, y: 25 },
  });
});

test('classic executor persists reissued move-to after activation', () => {
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
  const reissue = classicTacticalReissueOrder(g, getPlayerView(g, 'blue'), 'blue', g.units[0]);
  assert.equal(reissue?.kind, 'move-to');
});