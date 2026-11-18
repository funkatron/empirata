import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicEarlyProduction0x393A,
  classicFighterPressure0x3B45,
  classicInventoryBlock0x30EB,
  chooseClassicCityProduction,
  endTurn,
  makeRulesLab,
} from '../dist/engine/index.js';

test('0x30EB inventory uses PlayerView ownUnits (living + cargo)', () => {
  const g = makeRulesLab();
  const army = g.units.find(u => u.owner === 'red');
  g.units.push({
    ...structuredClone(army),
    id: 'cargo',
    kind: 'army',
    aboard: army.id,
    position: army.position,
  });
  const counts = classicInventoryBlock0x30EB(g, 'red');
  assert.equal(counts.army, 2);
});

test('0x393A early game commissions transport with no navy', () => {
  const counts = Object.fromEntries(
    ['army', 'fighter', 'destroyer', 'transport', 'submarine', 'cruiser', 'carrier', 'battleship'].map(k => [
      k,
      k === 'army' ? 1 : 0,
    ]),
  );
  assert.equal(classicEarlyProduction0x393A(counts, true, 1), 'transport');
  assert.equal(classicEarlyProduction0x393A(counts, false, 1), 'army');
  assert.equal(classicEarlyProduction0x393A({ ...counts, transport: 1 }, true, 1), null);
});

test('0x3B45 fighter pressure with transport adjacent', () => {
  const counts = { army: 4, fighter: 0, destroyer: 0, transport: 2, submarine: 0, cruiser: 0, carrier: 1, battleship: 1 };
  assert.equal(classicFighterPressure0x3B45(counts, true, 3, true), 'fighter');
  assert.equal(classicFighterPressure0x3B45(counts, true, 3, false), 'fighter');
  assert.equal(classicFighterPressure0x3B45({ ...counts, army: 1, fighter: 2 }, true, 3, false), null);
});

test('Opening coastal city chooses transport under 0x393A guard', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  const defender = g.units.find(u => u.owner === 'red');
  g.units = g.units.filter(u => u.owner !== 'red' || u.id === defender.id);
  defender.position = { ...city.position };
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'transport');
});