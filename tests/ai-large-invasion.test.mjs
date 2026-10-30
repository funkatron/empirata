import test from 'node:test';
import assert from 'node:assert/strict';
import {planAiLandingWave} from '../dist/engine/index.js';

test('Two transports coordinate a six-army hostile-city landing on a broad safe coast',()=>{
 const width=14,height=12;
 const view={width,height,active:'red',round:1,ownCities:[],ownUnits:[],enemies:[],events:[],
  cells:Array.from({length:width*height},()=>({terrain:'sea',visible:true,city:null}))};
 view.cells[3*width+7]={terrain:'land',visible:true,city:{id:'target',owner:'blue'}};
 for(let x=5;x<=9;x++)view.cells[4*width+x].terrain='land';
 for(const x of [6,7,9])view.cells[5*width+x].terrain='land';
 for(const [id,x] of [['first',5],['second',8]]){
  const ship={id,owner:'red',kind:'transport',position:{x,y:5},aboard:null,spent:0,damage:0,fuel:null,order:{kind:'none'},aiObjective:'target'};
  view.ownUnits.push(ship);
  for(let i=0;i<3;i++)view.ownUnits.push({...structuredClone(ship),id:`${id}-${i}`,kind:'army',aboard:id});
 }
 const plan=planAiLandingWave(view);
 assert.equal(plan.length,6);
 assert.equal(new Set(plan.map(p=>`${p.position.x},${p.position.y}`)).size,6);
 view.ownUnits.find(u=>u.id==='second-0').spent=1;
 assert.deepEqual(planAiLandingWave(view),[],'Wait for the shared six-army force when the coast supports it');
});
