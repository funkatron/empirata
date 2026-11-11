import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,moveUnit,stayUnit,advanceLabRound} from '../dist/engine/game.js';

test('ALG-013 a damaged ship repairs on arrival at friendly coastal city',()=>{
  const game=makeRulesLab();
  const ship=game.units.find(u=>u.owner==='blue'&&u.kind==='destroyer');
  ship.damage=2;
  const arrived=moveUnit(game,ship.id,{x:8,y:25});
  const repaired=arrived.units.find(u=>u.id===ship.id);
  assert.equal(repaired.damage,1);
  assert.equal(repaired.spent,3);
});
test('ALG-013 staying in friendly port repairs once and consumes movement',()=>{
  const game=makeRulesLab();
  const ship=game.units.find(u=>u.owner==='blue'&&u.kind==='destroyer');
  ship.position={x:8,y:25};ship.damage=2;
  const stayed=stayUnit(game,ship.id);
  assert.equal(stayed.units.find(u=>u.id===ship.id).damage,1);
  assert.throws(()=>stayUnit(stayed,ship.id),/No movement remaining/);
});
test('ALG-013 turn start does not repair idle ship automatically',()=>{
  const game=makeRulesLab();
  const ship=game.units.find(u=>u.owner==='blue'&&u.kind==='destroyer');
  ship.position={x:8,y:25};ship.damage=2;
  const next=advanceLabRound(game);
  assert.equal(next.units.find(u=>u.id===ship.id).damage,2);
});
