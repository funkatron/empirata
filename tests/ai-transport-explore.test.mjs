import test from 'node:test';import assert from 'node:assert/strict';
import {planAiTransportExploreStep} from '../dist/engine/index.js';
function fixture(){
 const width=12,height=12,cells=Array.from({length:144},()=>({terrain:'land',city:null,visible:false}));
 const ship={id:'transport',kind:'transport',aboard:null,owner:'red',position:{x:5,y:5}};
 for(const [x,y] of [[5,5],[4,5],[3,5],[6,5],[7,5]])cells[y*width+x].terrain='sea';
 // Western frontier has known coastline; eastern frontier is open water.
 for(const [x,y] of [[2,5],[3,4],[3,6],[7,4],[7,6],[8,5]])cells[y*width+x].terrain=null;
 for(const [x,y] of [[6,4],[6,6],[8,4],[8,6]])cells[y*width+x].terrain='sea';
 return {ship,view:{width,height,cells,ownUnits:[ship],enemies:[],active:'red'}};
}
test('Loaded-transport exploration prefers useful coastal discovery over open water',()=>{
 const {ship,view}=fixture();assert.deepEqual(planAiTransportExploreStep(view,ship),{x:4,y:5});
});
test('Transport exploration avoids fresh army threat ranges and unknown transit',()=>{
 const {ship,view}=fixture();view.enemies.push({kind:'army',position:{x:3,y:4},stale:false});
 assert.deepEqual(planAiTransportExploreStep(view,ship),{x:6,y:5});
 for(const y of [4,5,6])view.cells[y*view.width+6].terrain=null;
 assert.equal(planAiTransportExploreStep(view,ship),null);
});
test('Stale sightings do not permanently bar coastal exploration and input is immutable',()=>{
 const {ship,view}=fixture();view.enemies.push({kind:'army',position:{x:3,y:4},stale:true});
 const before=structuredClone(view);assert.deepEqual(planAiTransportExploreStep(view,ship),{x:4,y:5});assert.deepEqual(view,before);
});
