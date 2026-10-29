import test from 'node:test';
import assert from 'node:assert/strict';
import {planAiInvasionStep,planAiLandingSquares,makeAiInvasionLab,advanceLabRound,updateAllKnowledge} from '../dist/engine/index.js';

function coast(){
  const ship={id:'ship',kind:'transport',owner:'red',position:{x:5,y:5},aboard:null,
    spent:0,damage:0,fuel:null,order:{kind:'none'},aiObjective:'target'};
  const view={width:14,height:12,active:'red',round:1,
    cells:Array.from({length:14*12},()=>({terrain:'sea',visible:true,city:null})),
    ownUnits:[ship,{...structuredClone(ship),id:'cargo',kind:'army',aboard:ship.id}],
    ownCities:[],enemies:[],events:[]};
  view.cells[5*14+6]={terrain:'land',visible:true,city:{id:'target',owner:null,production:null,productionKnown:false}};
  view.cells[5*14+7].terrain='land';
  return {view,ship};
}

test('Transport repositions when adjacent only to a city that cannot receive a landing',()=>{
  const {view,ship}=coast(),before=structuredClone(view);
  assert.deepEqual(planAiLandingSquares(view,ship),[]);
  assert.deepEqual(planAiInvasionStep(view,ship),{x:6,y:4});
  assert.deepEqual(view,before);
  ship.position={x:6,y:4};
  assert.deepEqual(planAiLandingSquares(view,ship),[{x:7,y:5}]);
  assert.equal(planAiInvasionStep(view,ship),null,'Hold only beside a usable beach');
});

test('A friendly occupied beach does not make a transport hold outside landing range',()=>{
  const {view,ship}=coast();
  view.cells[4*14+6].terrain='land';
  view.ownUnits.push({...structuredClone(view.ownUnits[1]),id:'blocker',aboard:null,position:{x:6,y:4}});
  assert.deepEqual(planAiLandingSquares(view,ship),[]);
  const step=planAiInvasionStep(view,ship);
  assert.ok(step,'The ship must keep approaching the free beach');
  assert.notDeepEqual(step,{x:6,y:4},'Do not sail onto the blocking army');
});

test('Fresh non-army occupants block a beach; stale sightings do not',()=>{
  const {view,ship}=coast();
  view.cells[4*14+6].terrain='land';
  view.enemies.push({id:'guard',kind:'fighter',owner:'blue',position:{x:6,y:4},stale:false});
  assert.ok(planAiInvasionStep(view,ship),'A fresh non-army contact also occupies its beach');
  view.enemies[0].stale=true;
  assert.equal(planAiInvasionStep(view,ship),null,'The stale contact cannot prevent using this beach');
});

test('An actual transport rounds the city coast, lands and completes its mission',()=>{
  let g=makeAiInvasionLab();
  for(const u of g.units.filter(u=>u.id==='red-transport'||u.aboard==='red-transport'))u.position={x:73,y:29};
  updateAllKnowledge(g);
  const original=structuredClone(g);
  g=advanceLabRound(g);
  assert.notDeepEqual(g.units.find(u=>u.id==='red-transport').position,{x:73,y:29});
  assert.equal(original.units.find(u=>u.id==='red-transport').position.x,73);
  for(let i=0;i<3;i++)g=advanceLabRound(g);
  assert.ok(g.events.some(e=>e.message.includes('landed from red-transport')));
  assert.equal(g.cities.find(c=>c.id==='invasion-outpost').owner,'red');
});
