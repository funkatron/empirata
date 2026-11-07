import test from 'node:test';
import assert from 'node:assert/strict';
import {planAiGroundScoutStep,planAiNavalScoutStep} from '../dist/engine/index.js';

for(const [kind,terrain,plan] of [
  ['army','land',planAiGroundScoutStep],
  ['destroyer','sea',planAiNavalScoutStep],
]){
  test(`${kind} favors an unexplored frontier near a stale contact`,()=>{
    const width=15,height=15;
    const cells=Array.from({length:width*height},()=>({terrain,city:null,visible:false}));
    const ship={id:'scout',owner:'blue',kind,aboard:null,position:{x:7,y:7}};
    // Equal-distance frontiers to the north and south; the stale contact
    // lies near the northern frontier, not directly adjacent to either scout.
    cells[5*width+7].terrain=null;
    cells[9*width+7].terrain=null;
    const view={width,height,cells,ownUnits:[ship],ownCities:[],enemies:[
      {id:'old',owner:'red',kind:'army',position:{x:7,y:3},stale:true,observedRound:1},
    ],active:'blue',round:20};
    const before=structuredClone(view);
    const step=plan(view,ship);
    assert.ok(step);
    assert.equal(step.y,6,'Scout heads toward the contact-adjacent northern frontier');
    assert.deepEqual(view,before,'Planning does not mutate faction intelligence');
  });
}
