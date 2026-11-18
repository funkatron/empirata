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

test('0x393A: cityCount<=1 requests ship-mix; cityCount>1 uses fighters gate', () => {
  const counts = Object.fromEntries(
    ['army', 'fighter', 'destroyer', 'transport', 'submarine', 'cruiser', 'carrier', 'battleship'].map(k => [
      k,
      k === 'army' ? 1 : 0,
    ]),
  );
  assert.equal(classicEarlyProduction0x393A(counts, 1), 'ship-mix');
  assert.equal(classicEarlyProduction0x393A(counts, 2), 'transport');
  assert.equal(classicEarlyProduction0x393A({ ...counts, fighter: 2 }, 2), 'army');
});

test('0x3B45 fighter pressure with transport adjacent', () => {
  const counts = { army: 4, fighter: 0, destroyer: 0, transport: 2, submarine: 0, cruiser: 0, carrier: 1, battleship: 1 };
  assert.equal(classicFighterPressure0x3B45(counts, true, 3, true, 1), 'army');
  assert.equal(classicFighterPressure0x3B45(counts, true, 3, false, 1), null);
  assert.equal(classicFighterPressure0x3B45({ ...counts, army: 1, fighter: 2 }, true, 3, false, 1), 'army');
  assert.equal(classicFighterPressure0x3B45(counts, true, 6, false, 4), 'army');
});

test('Opening coastal city chooses transport under 0x393A guard', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  const defender = g.units.find(u => u.owner === 'red');
  g.units = g.units.filter(u => u.owner !== 'red' || u.id === defender.id);
  defender.position = { ...city.position };
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'transport');
});