import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseClassicCityProduction,
  classicLiveUnitCounts,
  endTurn,
  makeRulesLab,
  playRedOpponent,
} from '../dist/engine/index.js';

test('Classic inventory counts live owned units', () => {
  const g = makeRulesLab();
  const counts = classicLiveUnitCounts(g, 'red');
  assert.equal(counts.army, 1);
  assert.equal(counts.transport, 0);
});

test('Undefended computer city receives army production', () => {
  const g = makeRulesLab();
  const city = g.cities.find(c => c.id === 'c-red');
  g.units = g.units.filter(u => u.owner !== 'red');
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'army');
});

test('Coastal computer city commissions transport when fleet is below two', () => {
  const g = endTurn(makeRulesLab());
  g.active = 'red';
  const city = g.cities.find(c => c.id === 'c-red');
  g.units.find(u => u.owner === 'red').position = { ...city.position };
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'transport');
});

test('Grade B coastal city picks destroyer once a transport exists', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  const army = g.units.find(u => u.owner === 'red');
  army.position = { ...city.position };
  g.units.push({
    ...structuredClone(army),
    id: 'red-tr-a',
    kind: 'transport',
    position: { x: 82, y: 36 },
    aboard: null,
  });
  g.units.push({
    ...structuredClone(army),
    id: 'red-tr-b',
    kind: 'transport',
    position: { x: 83, y: 36 },
    aboard: null,
  });
  assert.equal(chooseClassicCityProduction(g, 'red', city, 2), 'destroyer');
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'army');
});

test('Coastal city commissions fighter when armies outnumber fighter wing three to one', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  const army = g.units.find(u => u.owner === 'red');
  army.position = { ...city.position };
  g.units.push(
    { ...structuredClone(army), id: 'a2', position: { x: 81, y: 36 } },
    { ...structuredClone(army), id: 'a3', position: { x: 82, y: 36 } },
    { ...structuredClone(army), id: 'a4', position: { x: 83, y: 36 } },
    {
      ...structuredClone(army),
      id: 'tr',
      kind: 'transport',
      position: { x: 84, y: 36 },
      aboard: null,
    },
    {
      ...structuredClone(army),
      id: 'tr2',
      kind: 'transport',
      position: { x: 85, y: 36 },
      aboard: null,
    },
  );
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'fighter');
});

test('Coastal city commissions carrier once destroyers and transports exist', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  g.units.find(u => u.owner === 'red').position = { ...city.position };
  const army = g.units.find(u => u.owner === 'red');
  g.units.push(
    {
      ...structuredClone(army),
      id: 'tr',
      kind: 'transport',
      position: { x: 82, y: 36 },
      aboard: null,
    },
    {
      ...structuredClone(army),
      id: 'tr2',
      kind: 'transport',
      position: { x: 83, y: 36 },
      aboard: null,
    },
    {
      ...structuredClone(army),
      id: 'dd',
      kind: 'destroyer',
      position: { x: 84, y: 36 },
      fuel: null,
    },
  );
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'carrier');
});

test('Classic policy assigns production without modern army-first heuristics on empty city', () => {
  const g = endTurn(makeRulesLab());
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.units = g.units.filter(u => u.owner !== 'red');
  const next = playRedOpponent(g);
  assert.equal(next.cities.find(c => c.id === 'c-red').production, 'army');
});