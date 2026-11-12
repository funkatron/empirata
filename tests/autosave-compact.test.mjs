import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceLabRound,exportAutosave,exportSave,importSave,labRoundPhases,makeAiVsAiLab,
} from '../dist/engine/index.js';

test('Compact autosave round-trips to the same game as pretty export',()=>{
  let g=makeAiVsAiLab();
  for(let i=0;i<12;i++)g=advanceLabRound(g);
  const pretty=importSave(exportSave(g));
  const compact=importSave(exportAutosave(g));
  assert.deepEqual(compact,pretty);
  assert.ok(exportAutosave(g).length<exportSave(g).length);
});

test('Phased lab rounds match monolithic advanceLabRound',()=>{
  const start=makeAiVsAiLab();
  let mono=start;
  let phased=importSave(exportSave(start));
  for(let i=0;i<20;i++){
    mono=advanceLabRound(mono);
    for(const phase of labRoundPhases(phased))phased=phase(phased);
    assert.equal(exportSave(phased),exportSave(mono));
  }
});
