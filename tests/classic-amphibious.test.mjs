import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicOffshoreObjectives,
  classicTransportLandingChoice,
  classicTransportObjective,
  disembarkArmy,
  getPlayerView,
  makeRulesLab,
  playBlueOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

function classicSealiftFixture() {
  const g = makeRulesLab();
  g.scenario = 'ai-vs-ai';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.units = [];
  g.nextId = 1;
  for (let y = 28; y <= 32; y++) {
    for (let x = 72; x <= 83; x++) g.tiles[y * g.width + x] = 'sea';
  }
  for (const x of [73, 74, 75]) g.tiles[29 * g.width + x] = 'land';
  g.cities.push({
    id: 'neutral-offshore',
    position: { x: 74, y: 29 },
    owner: null,
    production: null,
    progress: 0,
    firstCycle: true,
  });
  const blueHome = g.cities.find(c => c.owner === 'blue');
  const ship = {
    id: 't1',
    owner: 'blue',
    kind: 'transport',
    position: { x: 81, y: 30 },
    order: { kind: 'none' },
    spent: 0,
    damage: 0,
    aboard: null,
  };
  const army = {
    id: 'a1',
    owner: 'blue',
    kind: 'army',
    position: { x: 81, y: 30 },
    aboard: 't1',
    order: { kind: 'none' },
    spent: 0,
    damage: 0,
  };
  g.units = [ship, army];
  g.active = 'blue';
  updateAllKnowledge(g);
  // Blue learned the offshore neutral on an earlier scout pass.
  const scout = {
    id: 'scout',
    owner: 'blue',
    kind: 'army',
    position: { x: 74, y: 30 },
    aboard: null,
    order: { kind: 'none' },
    spent: 0,
    damage: 0,
  };
  g.units.push(scout);
  updateAllKnowledge(g);
  g.units = g.units.filter(u => u.id !== 'scout');
  updateAllKnowledge(g);
  return { g, blueHome };
}

test('classicOffshoreObjectives lists charted neutrals unreachable by land armies', () => {
  const { g } = classicSealiftFixture();
  const view = getPlayerView(g, 'blue');
  const offshore = classicOffshoreObjectives(g, view, 'blue');
  assert.equal(offshore.length, 1);
  assert.deepEqual(offshore[0], { x: 74, y: 29 });
});

test('loaded transport picks offshore objective and can land adjacent army', () => {
  const { g } = classicSealiftFixture();
  const ship = g.units.find(u => u.id === 't1');
  const view = getPlayerView(g, 'blue');
  assert.ok(classicTransportObjective(g, view, 'blue', ship));
  ship.position = { x: 72, y: 29 };
  updateAllKnowledge(g);
  const landing = classicTransportLandingChoice(g, getPlayerView(g, 'blue'), ship);
  assert.equal(landing?.kind, 'disembark');
  const after = disembarkArmy({ ...g, active: 'blue' }, landing.armyId, landing.to, false);
  assert.equal(after.units.find(u => u.id === 'a1')?.aboard, null);
});

test('classic AI advances a loaded transport toward a charted offshore neutral', () => {
  let { g } = classicSealiftFixture();
  const start = g.units.find(u => u.id === 't1').position;
  g = playBlueOpponent(g);
  const end = g.units.find(u => u.id === 't1').position;
  assert.ok(
    Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) > 0 ||
      g.units.some(u => u.id === 'a1' && !u.aboard),
  );
});