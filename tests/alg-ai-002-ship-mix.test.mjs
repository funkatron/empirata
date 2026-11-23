import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseClassicCityProduction,
  classicShipMixProduction,
  nearbyEnemyCount,
  makeRulesLab,
  endTurn,
} from '../dist/engine/index.js';
import {dosShipMixChoice} from '../dist/engine/index.js';

test('classicShipMixProduction downgrades when higher tier outnumbers lower', () => {
  const counts = Object.fromEntries(
    ['army', 'fighter', 'destroyer', 'transport', 'submarine', 'cruiser', 'carrier', 'battleship'].map(k => [k, 0]),
  );
  counts.battleship = 2;
  counts.carrier = 0;
  assert.equal(classicShipMixProduction(counts), 'carrier');
});

test('Threat stack near city commissions army before ship mix', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  const army = g.units.find(u => u.owner === 'red');
  army.position = { ...city.position };
  const foePos = { x: city.position.x + 1, y: city.position.y };
  g.units.push(
    ...Array.from({ length: 6 }, (_, i) => ({
      ...structuredClone(army),
      id: `foe-${i}`,
      owner: 'blue',
      position: foePos,
      aboard: null,
    })),
  );
  assert.ok(nearbyEnemyCount(g, 'red', city) > 5);
  assert.equal(chooseClassicCityProduction(g, 'red', city, 1), 'army');
});

test('Mature coastal city can select battleship from ship-mix pass', () => {
  const g = endTurn(makeRulesLab());
  const city = g.cities.find(c => c.id === 'c-red');
  const army = g.units.find(u => u.owner === 'red');
  army.position = { ...city.position };
  for (const kind of ['transport', 'destroyer', 'submarine', 'cruiser', 'carrier', 'battleship']) {
    g.units.push({
      ...structuredClone(army),
      id: `mix-${kind}`,
      kind,
      position: { x: 81, y: 36 },
      aboard: null,
    });
  }
  const pick = chooseClassicCityProduction(g, 'red', city, 2);
  assert.ok(['battleship', 'carrier', 'cruiser', 'submarine', 'transport', 'destroyer'].includes(pick));
});

const inventory=(changes={})=>({army:0,fighter:0,destroyer:0,transport:0,submarine:0,cruiser:0,carrier:0,battleship:0,...changes});

test('ALG-AI-002: grade B prioritizes first battleship when absent',()=>{
  assert.equal(dosShipMixChoice(inventory(),2),'battleship');
});

test('ALG-AI-002: grade A selects carrier if none exist',()=>{
  assert.equal(dosShipMixChoice(inventory(),1),'carrier');
});

test('ALG-AI-002: transport minimum takes precedence after fleet anchors',()=>{
  assert.equal(dosShipMixChoice(inventory({battleship:1,carrier:1}),2),'transport');
  assert.equal(dosShipMixChoice(inventory({battleship:1,carrier:1,transport:1}),1),'transport');
});

test('ALG-AI-002: grade B requests destroyer when none exists and transports available',()=>{
  assert.equal(dosShipMixChoice(inventory({battleship:1,carrier:1,transport:2}),2),'destroyer');
});

test('ALG-AI-002: high-to-low ship-mix scan prefers scarce lower type',()=>{
  assert.equal(dosShipMixChoice(inventory({battleship:3,carrier:2,cruiser:1,submarine:4,transport:2,destroyer:1}),1),'destroyer');
});

test('ALG-AI-002: rejects invalid inventory and grade',()=>{
  assert.throws(()=>dosShipMixChoice(inventory({carrier:-1}),1));
  assert.throws(()=>dosShipMixChoice(inventory({carrier:1.5}),1));
  assert.throws(()=>dosShipMixChoice(inventory(),3));
});
