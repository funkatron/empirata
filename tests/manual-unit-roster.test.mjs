import test from 'node:test';
import assert from 'node:assert/strict';
import {STATS,UNIT_TYPES,MAX_FIGHTER_FUEL,movementAllowance,capacity,requiredProductionTurns}
  from '../dist/engine/index.js';

// Baseline: docs/Empirata_Classic_Rules_Specification_v0.1.md §4,
// which cites the Interstel 2.05 manual pp. 20–25. This checks internal
// conformance to the research transcription, not executable parity.
const canonical={
  army:      [1,1,1,6,5,'land'],
  fighter:   [5,1,1,12,10,'air'],
  destroyer: [3,3,1,24,20,'sea'],
  transport: [2,3,1,30,25,'sea'],
  submarine: [2,2,3,24,20,'sea'],
  cruiser:   [2,8,2,35,30,'sea'],
  carrier:   [2,8,1,48,40,'sea'],
  battleship:[2,12,3,60,50,'sea']
};

test('All eight Interstel 2.05 unit types match the documented reference table',()=>{
  assert.deepEqual([...UNIT_TYPES].sort(),Object.keys(canonical).sort());
  for(const [kind,[movement,hitPoints,hitDamage,first,repeat,domain]] of Object.entries(canonical)){
    const unit=STATS[kind];
    assert.ok(unit,kind+' missing');
    assert.deepEqual([unit.movement,unit.hitPoints,unit.hitDamage,unit.first,unit.repeat,unit.domain],
      [movement,hitPoints,hitDamage,first,repeat,domain],kind+' differs from transcribed manual table');
    assert.equal(requiredProductionTurns(kind,true),first);
    assert.equal(requiredProductionTurns(kind,false),repeat);
  }
  assert.equal(MAX_FIGHTER_FUEL,20);
});

test('Manual ship damage thresholds reduce movement at half maximum damage',()=>{
  for(const kind of ['destroyer','transport','submarine','cruiser','carrier','battleship']){
    const stats=STATS[kind];
    const ship={kind,damage:Math.ceil(stats.hitPoints/2)-1};
    assert.equal(movementAllowance(ship),stats.movement,kind+' before half damage');
    ship.damage=Math.ceil(stats.hitPoints/2);
    assert.equal(movementAllowance(ship),1,kind+' at half damage');
  }
});

test('Manual transport and carrier capacity decreases with hull damage',()=>{
  for(let damage=0;damage<=3;damage++)
    assert.equal(capacity({kind:'transport',damage}),Math.max(0,6-2*damage));
  for(let damage=0;damage<=8;damage++)
    assert.equal(capacity({kind:'carrier',damage}),Math.max(0,8-damage));
  assert.equal(capacity({kind:'army',damage:0}),null);
});

test('Nonstandard production efficiency remains explicitly unverified',()=>{
  assert.throws(()=>requiredProductionTurns('army',true,25),/not verified/);
  assert.throws(()=>requiredProductionTurns('army',true,100),/not verified/);
});
