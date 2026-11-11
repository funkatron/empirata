import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab} from '../dist/engine/game.js';
import {resolveCargoOverload} from '../dist/engine/cargo-overload.js';

function cargoFixture(kind, damage, count) {
  const game=makeRulesLab();
  const ship={id:'ship',owner:'blue',kind,position:{x:20,y:20},damage,spent:0,fuel:null,order:{kind:'none'},aboard:null};
  const cargoKind=kind==='transport'?'army':'fighter';
  game.units.push(ship);
  for(let i=0;i<count;i++)game.units.push({
    id:'cargo-'+i,owner:'blue',kind:cargoKind,position:{...ship.position},
    damage:0,spent:0,fuel:cargoKind==='fighter'?20:null,order:{kind:'none'},aboard:ship.id
  });
  return {game,ship};
}

test('ALG-011 damaged transport retains highest-slot cargo without RNG',()=>{
  const {game,ship}=cargoFixture('transport',2,5); // 3 HP - 2 damage => capacity 2
  const originalRng={...game.rng};
  const lost=resolveCargoOverload(game,ship);
  assert.deepEqual(lost,['cargo-2','cargo-1','cargo-0']);
  assert.deepEqual(game.units.filter(u=>u.aboard===ship.id).map(u=>u.id),['cargo-3','cargo-4']);
  assert.deepEqual(game.rng,originalRng);
});
test('ALG-011 carrier retains highest-slot fighters',()=>{
  const {game,ship}=cargoFixture('carrier',6,4); // 8 HP - 6 damage => capacity 2
  assert.deepEqual(resolveCargoOverload(game,ship),['cargo-1','cargo-0']);
  assert.deepEqual(game.units.filter(u=>u.aboard===ship.id).map(u=>u.id),['cargo-2','cargo-3']);
});
test('ALG-011 no overload leaves cargo untouched',()=>{
  const {game,ship}=cargoFixture('transport',0,3);
  assert.deepEqual(resolveCargoOverload(game,ship),[]);
  assert.equal(game.units.filter(u=>u.aboard===ship.id).length,3);
});
