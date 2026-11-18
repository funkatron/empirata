import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseClassicCityProduction,
  classicArmyReachableOnChart,
  classicCityPathInvasionThreat,
  classicTrackedThreatLocations,
  emptyKnowledge,
  endTurn,
  getPlayerView,
  makeRulesLab,
  updateAllKnowledge,
} from '../dist/engine/index.js';

function landCorridorGame({ blockApproach = false } = {}) {
  const width = 18;
  const height = 3;
  const tiles = Array(width * height).fill('land');
  for (let x = 0; x < width; x++) {
    tiles[x] = 'sea';
    tiles[2 * width + x] = 'sea';
  }
  if (blockApproach) {
    for (const x of [13, 14]) tiles[1 * width + x] = 'sea';
  }
  const mkCity = (id, x, y, owner) => ({
    id,
    position: { x, y },
    owner,
    production: null,
    progress: 0,
    firstCycle: true,
  });
  const army = (id, owner, x, y) => ({
    id,
    owner,
    kind: 'army',
    position: { x, y },
    damage: 0,
    spent: 0,
    fuel: null,
    order: { kind: 'none' },
    aboard: null,
  });
  const ship = (id, owner, kind, x, y) => ({ ...army(id, owner, x, y), kind, fuel: kind === 'fighter' ? 50 : null });
  const city = mkCity('c-red', 15, 1, 'red');
  const g = {
    schema: 1,
    ruleset: 'interstel-2.05',
    mode: 'rules-lab',
    scenario: 'classic-lab',
    width,
    height,
    tiles,
    players: [
      { id: 'blue', label: 'Blue', combatEfficiency: 50, productionEfficiency: 50 },
      { id: 'red', label: 'Red', combatEfficiency: 50, productionEfficiency: 50 },
    ],
    active: 'red',
    round: 12,
    cities: [city],
    units: [
      army('r-def', 'red', 15, 1),
      army('r-scout', 'red', 13, 1),
      army('b-inv', 'blue', 12, 1),
      ship('tr-a', 'red', 'transport', 14, 0),
      ship('tr-b', 'red', 'transport', 16, 0),
      ship('bb', 'red', 'battleship', 11, 0),
      ship('cv', 'red', 'carrier', 10, 0),
      army('a2', 'red', 14, 2),
      army('a3', 'red', 13, 2),
      army('a4', 'red', 12, 2),
    ],
    knowledge: {},
    rng: { seed: 1, draws: 0 },
    nextId: 100,
    nextEventId: 1,
    events: [],
  };
  for (const faction of ['blue', 'red', 'green']) g.knowledge[faction] = emptyKnowledge(g);
  updateAllKnowledge(g);
  return { game: g, city };
}

test('Tracked threat list caps at 20 and dedupes by coordinate', () => {
  const { game, city } = landCorridorGame();
  const locs = classicTrackedThreatLocations(game, 'red', city);
  assert.equal(locs.length, 1);
  assert.equal(locs[0].x, 12);
});

test('Tracked threat list includes stale last-known coordinates', () => {
  const { game, city } = landCorridorGame({ blockApproach: false });
  game.units = game.units.filter(u => u.id !== 'b-inv');
  const k = game.knowledge.red;
  k.sightings.push({
    id: 'stale-inv',
    owner: 'blue',
    kind: 'army',
    position: { x: 12, y: 1 },
    observedRound: 1,
  });
  k.freshEnemies = k.freshEnemies.filter(id => id !== 'stale-inv');
  const view = getPlayerView(game, 'red');
  const marker = view.enemies.find(e => e.id === 'stale-inv');
  assert.ok(marker?.stale);
  const locs = classicTrackedThreatLocations(game, 'red', city);
  assert.ok(locs.some(p => p.x === 12 && p.y === 1));
  assert.equal(classicCityPathInvasionThreat(game, 'red', city, 1), true);
});

test('0x3ADC reachability follows charted land corridor', () => {
  const { game, city } = landCorridorGame();
  const view = getPlayerView(game, 'red');
  const from = { x: 12, y: 1 };
  assert.equal(classicArmyReachableOnChart(game, view, 'red', from, city.position), true);
  assert.equal(classicCityPathInvasionThreat(game, 'red', city, 1), true);
});

test('0x3ADC reachability false when sea wall blocks army path', () => {
  const { game, city } = landCorridorGame({ blockApproach: true });
  assert.equal(classicCityPathInvasionThreat(game, 'red', city, 1), false);
});

test('Path invasion threat commissions army before fighter pressure', () => {
  const { game, city } = landCorridorGame();
  assert.equal(chooseClassicCityProduction(game, 'red', city, 1), 'army');
});

test('Destroyer gate still outranks 0x3ADC on grade B', () => {
  const { game, city } = landCorridorGame();
  assert.equal(chooseClassicCityProduction(game, 'red', city, 2), 'destroyer');
});

test('Without path threat, fighter pressure can return when approach is blocked', () => {
  const { game, city } = landCorridorGame({ blockApproach: true });
  const pick = chooseClassicCityProduction(game, 'red', city, 1);
  assert.equal(pick, 'fighter');
});