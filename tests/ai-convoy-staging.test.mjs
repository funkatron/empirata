import test from 'node:test';import assert from 'node:assert/strict';
import {planAiConvoyStaging,planAiTransportAssembly} from '../dist/engine/index.js';
function fleet(){
 const width=30,height=18,v={width,height,active:'red',round:1,ownCities:[],ownUnits:[],enemies:[],events:[],cells:Array.from({length:width*height},()=>({terrain:'sea',visible:true,city:null}))};
 v.cells[8*width+24]={terrain:'land',visible:true,city:{id:'target',owner:'blue'}};
 for(const [id,x] of [['lead',18],['rear',8]]){
  const u={id,owner:'red',kind:'transport',position:{x,y:8},spent:0,damage:0,fuel:null,aboard:null,order:{kind:'none'},aiObjective:'target'};v.ownUnits.push(u,{...structuredClone(u),id:`${id}-army`,kind:'army',aboard:id});
 }
 return v;
}
test('Convoy shares a staging position and estimates damaged ship arrival from known routes',()=>{
 const v=fleet(),lead=v.ownUnits[0],rear=v.ownUnits[2];
 const a=planAiConvoyStaging(v,lead),b=planAiConvoyStaging(v,rear);
 assert.deepEqual(a.staging,b.staging);assert.equal(a.next,null);assert.ok(b.next.x>rear.position.x);assert.ok(b.groupEta>0);
 rear.damage=2;const damaged=planAiConvoyStaging(v,rear);assert.ok(damaged.eta>b.eta);
});
test('Disconnected or unknown sea cannot supply a fabricated rendezvous route',()=>{
 const v=fleet();for(let y=1;y<v.height-1;y++)v.cells[y*v.width+14].terrain=null;
 assert.equal(planAiConvoyStaging(v,v.ownUnits[0]),null);
});
test('Route-time deadline releases a force that cannot assemble within remaining time',()=>{
 const v=fleet(),ship=v.ownUnits[0];ship.aiAssembly={objective:'target',startedRound:1};v.round=12;
 assert.equal(planAiTransportAssembly(v,ship).wait,false);
});
test('Gathered convoy does not return to its old staging point',()=>{
 const v=fleet(),lead=v.ownUnits[0];lead.aiAssembly={objective:'target',startedRound:1,staging:{x:18,y:8}};
 v.ownUnits[2].position={x:16,y:8};const assembled=planAiTransportAssembly(v,lead);assert.equal(assembled.ship.aiAssembly.gathered,true);
 v.ownUnits[2].position={x:8,y:8};assert.equal(planAiTransportAssembly(v,assembled.ship).wait,false);
});
