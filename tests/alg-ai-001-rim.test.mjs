import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_DOS_DIRECTION_ORDER,
  classicDosDirectionIndex,
  classicRotateDirectionIndex,
  classicRandomRotationBias,
  classicResolveLegalDirection,
  classicAdvanceBearingWhenBlocked,
  directions,
  makeRulesLab,
  playRedOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

// DOS direction table 2E32:6300 (linear 0x34620): location deltas, map width 100.
// See agents/alg-ai-001-compass-order-trace-2026-11-24.md.
const DOS_LOCATION_DELTAS = [1, -99, -100, -101, -1, 99, 100, 101];
const N = 1;
const NE = 2;
const NW = 0;
const E = 4;
const W = 3;

test('CLASSIC_DOS_DIRECTION_ORDER reproduces the DOS location-delta table', () => {
  assert.equal(CLASSIC_DOS_DIRECTION_ORDER.length, 8);
  CLASSIC_DOS_DIRECTION_ORDER.forEach((engineIndex, dosIndex) => {
    const d = directions[engineIndex];
    assert.equal(d.y * 100 + d.x, DOS_LOCATION_DELTAS[dosIndex], `DOS index ${dosIndex}`);
    assert.equal(classicDosDirectionIndex(engineIndex), dosIndex);
  });
});

test('classicRotateDirectionIndex steps to an adjacent compass point around the DOS ring', () => {
  for (let i = 0; i < 8; i++) {
    for (const step of [1, -1]) {
      const a = directions[i];
      const b = directions[classicRotateDirectionIndex(i, step)];
      assert.ok(Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1, `${i} ${step} not adjacent`);
      assert.notDeepEqual(a, b);
    }
    assert.equal(classicRotateDirectionIndex(i, 8), i);
    assert.equal(classicRotateDirectionIndex(i, -8), i);
  }
  // +1 is counter-clockwise in DOS order: N -> NW -> W; -1: N -> NE -> E.
  assert.equal(classicRotateDirectionIndex(N, 1), NW);
  assert.equal(classicRotateDirectionIndex(N, 2), W);
  assert.equal(classicRotateDirectionIndex(N, -1), NE);
  assert.equal(classicRotateDirectionIndex(N, -2), E);
  assert.throws(() => classicDosDirectionIndex(8));
});

function rimShip(g) {
  return {
    ...g.units[0],
    id: 'rim-ship',
    owner: 'red',
    kind: 'destroyer',
    position: { x: 50, y: 1 },
    order: { kind: 'none' },
    fuel: null,
  };
}

test('classicResolveLegalDirection on the top rim sweeps the DOS ring with no rim special case', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const unit = rimShip(g);
  g.units = [unit];
  updateAllKnowledge(g);
  assert.equal(classicRandomRotationBias(unit), -1);
  // N and NE leave the playable map; the third DOS probe (E) is the first legal one.
  const resolved = classicResolveLegalDirection(g, unit, N, 1);
  assert.equal(resolved.directionIndex, E);
  assert.deepEqual(resolved.step, { x: 51, y: 1 });
});

test('Classic none order on the top rim takes one legal step inside the map', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  g.units = [rimShip(g)];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  updateAllKnowledge(g);
  const next = playRedOpponent(structuredClone(g));
  const u = next.units[0];
  assert.ok(u.position.y >= 1 && u.position.y <= 2);
  assert.equal(Math.max(Math.abs(u.position.x - 50), Math.abs(u.position.y - 1)), 1);
  assert.equal(u.order.kind, 'none');
});

test('classicAdvanceBearingWhenBlocked rotates one DOS ring step by unit parity bias', () => {
  assert.equal(classicRandomRotationBias({ id: 'aa' }), 1);
  assert.equal(classicAdvanceBearingWhenBlocked({ id: 'aa', kind: 'destroyer' }, N), NW);
  assert.equal(classicRandomRotationBias({ id: 'ab' }), -1);
  assert.equal(classicAdvanceBearingWhenBlocked({ id: 'ab', kind: 'destroyer' }, N), NE);
});
