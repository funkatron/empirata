import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHitThreshold, resolveCombat } from '../dist/engine/combat.js';
import { makeRulesLab } from '../dist/engine/game.js';
import { nextRandom15 } from '../dist/engine/rng.js';

test('ALG-002 default equal efficiencies yield threshold 100', () => {
  assert.equal(combatHitThreshold('destroyer','cruiser',50,50),100);
});
test('ALG-002 attacker transport and carrier have half efficiency', () => {
  assert.equal(combatHitThreshold('transport','destroyer',50,50),75);
  assert.equal(combatHitThreshold('carrier','destroyer',50,50),75);
});
test('ALG-002 defending transport and submarine have half efficiency', () => {
  assert.equal(combatHitThreshold('destroyer','transport',50,50),125);
  assert.equal(combatHitThreshold('destroyer','submarine',50,50),125);
});
test('ALG-002 ship attacking army halves defending efficiency', () => {
  assert.equal(combatHitThreshold('cruiser','army',50,50),125);
});
test('ALG-002 half-factors truncate odd efficiencies independently', () => {
  assert.equal(combatHitThreshold('transport','submarine',51,51),100);
  assert.equal(combatHitThreshold('carrier','army',51,51),100);
});
test('ALG-002 uses raw DOS rand15 modulo 200 rather than normalized odds', () => {
  const {value}=nextRandom15({seed:1,draws:0});
  assert.equal(Number.isInteger(value),true);
  assert.ok(value>=0 && value<=32767);
  const threshold=combatHitThreshold('army','fighter',50,50);
  assert.equal(threshold>value%200, (value%200)<100);
});

test('ALG-002 seeded army duel consumes one DOS roll and destroys the loser', () => {
  const game=makeRulesLab();
  const attacker=game.units.find(u=>u.owner==='blue' && u.kind==='army');
  const defender=game.units.find(u=>u.owner==='red' && u.kind==='army');
  defender.position={x:attacker.position.x+1,y:attacker.position.y};
  game.rng={seed:1,draws:0};
  const {value,next}=nextRandom15(game.rng);
  const result=resolveCombat(game,attacker.id,defender.id);
  const attackerWins=value%200<100;
  assert.equal(result.units.some(u=>u.id===attacker.id),attackerWins);
  assert.equal(result.units.some(u=>u.id===defender.id),!attackerWins);
  assert.equal(result.rng.draws,1);
  assert.equal(result.rng.seed,next.seed);
});
