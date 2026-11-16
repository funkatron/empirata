import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicEscortStep,
  classicMaskProfile,
  classicSanitizeTransportOrder,
  classicTilePassable,
  isCoastalSeaTile,
  makeRulesLab,
} from '../dist/engine/index.js';

test('classicMaskProfile selects ship-b for grade 2 destroyer', () => {
  const g = makeRulesLab();
  const dd = g.units.find(u => u.kind === 'destroyer');
  assert.equal(classicMaskProfile(dd, 1), 'ship-a');
  assert.equal(classicMaskProfile(dd, 2), 'ship-b');
  assert.equal(classicMaskProfile({ ...dd, kind: 'transport' }, 2), 'ship-a');
});

test('ship-b blocks coastal sea for destroyers but not transports', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  g.tiles[30 * g.width + 50] = 'land';
  const coastalSea = { x: 51, y: 30 };
  const openSea = { x: 55, y: 30 };
  assert.equal(isCoastalSeaTile(g, coastalSea), true);
  assert.equal(isCoastalSeaTile(g, openSea), false);
  const dd = { ...g.units.find(u => u.kind === 'destroyer'), position: { x: 49, y: 30 } };
  assert.equal(classicTilePassable(g, 'blue', dd, openSea, 2), true);
  assert.equal(classicTilePassable(g, 'blue', dd, coastalSea, 2), false);
  assert.equal(classicTilePassable(g, 'blue', dd, coastalSea, 1), true);
  const tr = { ...dd, kind: 'transport' };
  assert.equal(classicTilePassable(g, 'blue', tr, coastalSea, 2), true);
});

test('classicSanitizeTransportOrder clears escort on empty transport', () => {
  const tr = { kind: 'transport', order: { kind: 'escort', targetId: 'u1' } };
  assert.deepEqual(classicSanitizeTransportOrder(tr, 0), { kind: 'none' });
  assert.equal(classicSanitizeTransportOrder(tr, 1), null);
  assert.equal(classicSanitizeTransportOrder({ ...tr, order: { kind: 'load-ship' } }, 0), null);
});

test('classicEscortStep moves toward a station tile beside the target', () => {
  const g = makeRulesLab();
  g.tiles.fill('land');
  const escort = {
    ...g.units[0],
    id: 'escort-army',
    owner: 'red',
    kind: 'army',
    position: { x: 10, y: 10 },
    order: { kind: 'escort', targetId: 'ally' },
  };
  const ally = {
    ...g.units[0],
    id: 'ally',
    owner: 'red',
    kind: 'army',
    position: { x: 20, y: 10 },
    order: { kind: 'none' },
  };
  g.units = [escort, ally];
  const step = classicEscortStep(g, escort, 1);
  assert.ok(step);
  assert.equal(Math.max(Math.abs(step.x - escort.position.x), Math.abs(step.y - escort.position.y)), 1);
});