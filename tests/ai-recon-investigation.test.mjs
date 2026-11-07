import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,getPlayerView} from '../dist/engine/index.js';

test('Ground and naval scouts investigate remembered contacts on charted terrain',async()=>{
  const {planAiGroundScoutStep,planAiNavalScoutStep}=await import('../dist/engine/index.js');
  for(const [kind,terrain,plan] of [
    ['army','land',planAiGroundScoutStep],
    ['destroyer','sea',planAiNavalScoutStep],
  ]){
    const view=getPlayerView(makeRulesLab(),'blue');
    const fighter={...view.ownUnits[0],id:'scout',owner:'blue',kind,position:{x:30,y:30},aboard:null};
    view.ownUnits=[fighter];
    view.cells=view.cells.map(()=>({terrain,visible:false,city:null}));
    fighter.kind=kind;
    view.enemies=[{id:'old',owner:'red',kind:'army',position:{x:34,y:30},stale:true,observedRound:1}];
    const before=structuredClone(view),step=plan(view,fighter);
    assert.ok(step);
    assert.ok(step.x>fighter.position.x);
    assert.deepEqual(view,before);
    view.enemies=[];
    assert.equal(plan(view,fighter),null);
  }
});
