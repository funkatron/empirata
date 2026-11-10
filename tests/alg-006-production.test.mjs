import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredProductionTurns } from '../dist/engine/units.js';

test('ALG-006 recovered first and repeat tables at default efficiency', () => {
  const kinds = ['army','fighter','destroyer','transport','submarine','cruiser','carrier','battleship'];
  assert.deepEqual(kinds.map(k => requiredProductionTurns(k,true,50)), [6,12,24,30,24,36,48,60]);
  assert.deepEqual(kinds.map(k => requiredProductionTurns(k,false,50)), [5,10,20,25,20,30,40,50]);
});

test('ALG-006 efficiency scaling uses integer truncation', () => {
  assert.equal(requiredProductionTurns('cruiser',true,100),18);
  assert.equal(requiredProductionTurns('army',false,25),10);
  assert.equal(requiredProductionTurns('army',true,100),3);
  assert.equal(requiredProductionTurns('cruiser',true,0),999);
  assert.equal(requiredProductionTurns('battleship',true,1),999);
  assert.equal(requiredProductionTurns('army',true,33),9);
  assert.throws(() => requiredProductionTurns('army',true,-1),RangeError);
  assert.throws(() => requiredProductionTurns('army',true,50.5),RangeError);
});
