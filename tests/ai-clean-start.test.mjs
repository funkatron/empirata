import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAiVsAiLab,makeAiVsAiSkirmishLab,getPlayerView,advanceLabRound,requiredProductionTurns,exportSave,importSave} from '../dist/engine/index.js';

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
  assert.ok(getPlayerView(a,faction).cells.filter(c=>c.terrain!==null).length>9,'Produced armies explore');
 }
});
