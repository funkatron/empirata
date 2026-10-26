import test from 'node:test';
import assert from 'node:assert/strict';
import {planAiGroundStep,makeRulesLab,getPlayerView,updateAllKnowledge} from '../dist/engine/index.js';

function maze(){
  const width=10,height=10;
  const cells=Array.from({length:width*height},()=>({terrain:'land',visible:true,city:null}));
  for(let y=1;y<=6;y++)cells[y*width+4].terrain='sea';
  cells[3*width+7].city={id:'target',owner:'blue',production:null,productionKnown:false};
  const army={id:'red-army',owner:'red',kind:'army',position:{x:3,y:3},
    damage:0,spent:0,fuel:null,aboard:null,order:{kind:'none'}};
  const view={width,height,active:'red',round:1,cells,ownUnits:[army],ownCities:[],enemies:[],events:[]};
  return {view,army};
}
const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));

test('Ground AI navigates around a water barrier instead of greedily walking into it',()=>{
  const {view,army}=maze();
  const visited=new Set();
  for(let i=0;i<25;i++){
    if(distance(army.position,{x:7,y:3})===1)break;
    const next=planAiGroundStep(view,army);
    assert.ok(next,'A land detour should exist');
    assert.equal(distance(next,army.position),1);
    assert.equal(view.cells[next.y*view.width+next.x].terrain,'land');
    assert.ok(!visited.has(next.y*view.width+next.x),'AI must not oscillate');
    visited.add(next.y*view.width+next.x);
    army.position=next;
  }
  assert.equal(distance(army.position,{x:7,y:3}),1);
  assert.ok(visited.size>=5,'The detour should be longer than a direct move');
});
test('Ground AI does not plan through a visible occupied square',()=>{
  const {view,army}=maze();
  const blocker={...structuredClone(army),id:'blocker',position:{x:3,y:4}};
  view.ownUnits.push(blocker);
  const step=planAiGroundStep(view,army);
  assert.ok(step);
  assert.notDeepEqual(step,blocker.position);
});
test('Ground AI does not move without a discovered target',()=>{
  const {view,army}=maze();
  view.cells[3*view.width+7].city=null;
  assert.equal(planAiGroundStep(view,army),null);
});
test('Ground AI is deterministic and never mutates faction knowledge',()=>{
  const {view,army}=maze(),original=structuredClone(view);
  const first=planAiGroundStep(view,army);
  assert.deepEqual(planAiGroundStep(view,army),first);
  assert.deepEqual(view,original);
});
test('Ground AI uses only visible or remembered map information',()=>{
  const a=makeRulesLab(),b=structuredClone(a);
  b.tiles[45*b.width+44]='land';
  updateAllKnowledge(a);updateAllKnowledge(b);
  const va=getPlayerView(a,'red'),vb=getPlayerView(b,'red');
  assert.deepEqual(va,vb);
  const {army}=maze();
  army.position={...va.ownUnits.find(u=>u.kind==='army').position};
  assert.deepEqual(planAiGroundStep(va,army),planAiGroundStep(vb,army));
});
