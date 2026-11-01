import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAiVsAiLab,makeAiVsAiSkirmishLab,getPlayerView,advanceLabRound,requiredProductionTurns,exportSave,importSave} from '../dist/engine/index.js';

test('Clean campaign ports have comparable coastal access and mirrored island offsets',()=>{
 const g=makeAiVsAiLab(),blue=g.cities.find(c=>c.owner==='blue'),red=g.cities.find(c=>c.owner==='red');
 assert.deepEqual(blue.position,{x:8,y:25});
 assert.deepEqual(red.position,{x:92,y:36});
 assert.equal(24-blue.position.x,red.position.x-76,'Both ports sit 16 tiles outward from their island centers');
 assert.equal(g.tiles[25*g.width+7],'sea','Blue harbor is directly adjacent');
 assert.equal(g.tiles[36*g.width+93],'sea','Red harbor is directly adjacent');
 assert.equal(g.tiles[36*g.width+81],'land','Old inland channel is removed');
 // Water from each port must connect to the surrounding ocean.
 for(const [start,direction] of [[blue.position,-1],[red.position,1]]){
  for(let x=start.x+direction;x>0&&x<g.width-1;x+=direction)
   assert.equal(g.tiles[start.y*g.width+x],'sea',`Port sea lane blocked at ${x},${start.y}`);
 }
});

test('Clean campaign starts with one city per side, no units and only city sight',()=>{
 const g=makeAiVsAiLab();
 assert.equal(g.units.length,0);assert.equal(g.round,1);assert.equal(g.rng.draws,0);
 for(const faction of ['blue','red']){
  const view=getPlayerView(g,faction);assert.equal(view.ownCities.length,1);
  assert.equal(view.enemies.length,0);
  assert.equal(view.cells.filter(c=>c.terrain!==null).length,9);
  assert.equal(view.cells.filter(c=>c.city).length,1);
  assert.equal(view.ownCities[0].production,null);
 }
 assert.equal(g.cities.filter(c=>c.owner===null).length,g.cities.length-2);
 assert.ok(g.cities.every(c=>c.progress===0&&c.firstCycle));
 assert.ok(makeAiVsAiSkirmishLab().units.length>0,'Staged fixture stays available');
});
test('Both clean-start factions produce their first units through normal production and replay exactly',()=>{
 let a=makeAiVsAiLab(),b=importSave(exportSave(a));
 const budget=requiredProductionTurns('army',true,50)+2;
 for(let i=0;i<budget;i++){
  a=advanceLabRound(a);b=advanceLabRound(b);assert.deepEqual(a,b);
 }
 for(const faction of ['blue','red']){
  assert.ok(a.events.some(e=>e.recipient===faction&&e.kind==='production'&&e.message.includes('completed Army')));
  assert.ok(getPlayerView(a,faction).ownCities.every(c=>getPlayerView(a,faction).ownUnits.some(u=>u.kind==='army'&&!u.aboard&&u.position.x===c.position.x&&u.position.y===c.position.y)),'First produced armies defend their cities');
 }
});
