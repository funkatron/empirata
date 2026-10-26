import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAiInvasionLab,advanceLabRound,exportSave,importSave} from '../dist/engine/index.js';

test('Opponent sea approach remains deterministic across a saved game',()=>{
  let baseline=makeAiInvasionLab();
  for(let i=0;i<2;i++)baseline=advanceLabRound(baseline);
  let restored=importSave(exportSave(baseline));
  for(let i=0;i<5;i++){
    baseline=advanceLabRound(baseline);
    restored=advanceLabRound(restored);
    assert.deepEqual(restored,baseline);
  }
});

test('First naval approach does not consume combat randomness',()=>{
  const initial=makeAiInvasionLab();
  const advanced=advanceLabRound(initial);
  assert.equal(advanced.rng.draws,initial.rng.draws);
});
