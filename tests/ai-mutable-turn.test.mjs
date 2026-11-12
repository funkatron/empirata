import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceLabRound,exportSave,importSave,makeAiVsAiLab,makeAiVsAiSkirmishLab,
  moveUnit,playAiOpponent,endTurn,
} from '../dist/engine/index.js';

test('Public moveUnit still leaves the input game unmodified',()=>{
  let g=makeAiVsAiLab();
  for(let i=0;i<20;i++)g=advanceLabRound(g);
  const before=exportSave(g);
  const army=g.units.find(u=>u.owner===g.active&&u.kind==='army'&&!u.aboard);
  if(!army)return;
  const dest={x:army.position.x+1,y:army.position.y};
  try{moveUnit(g,army.id,dest);}catch{/* Illegal adjacent tile is fine for this immutability check. */}
  assert.equal(exportSave(g),before);
});

test('AI turns keep seeded outcomes identical across two private clones',()=>{
  const start=()=>{
    let g=makeAiVsAiSkirmishLab();
    for(let i=0;i<15;i++)g=advanceLabRound(g);
    return g;
  };
  const a=start(),b=importSave(exportSave(a));
  assert.equal(exportSave(advanceLabRound(a)),exportSave(advanceLabRound(b)));
});

test('playAiOpponent does not mutate the caller-supplied game object',()=>{
  let g=makeAiVsAiLab();
  g=endTurn(g); // red to move when scenario allows; otherwise skip
  if(g.active!=='red'&&g.active!=='blue')return;
  const snapshot=exportSave(g);
  try{playAiOpponent(g,g.active);}catch{/* Active faction may already be finished producing. */}
  assert.equal(exportSave(g),snapshot);
});
