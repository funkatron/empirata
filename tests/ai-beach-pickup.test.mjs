import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,emptyKnowledge,updateAllKnowledge,getPlayerView,playRedOpponent,planAiBeachPickup,exportSave,importSave} from '../dist/engine/index.js';
function beach(){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');g.cities=[];
 for(let x=50;x<=55;x++)g.tiles[30*g.width+x]='land';
 g.units=[{...structuredClone(base),id:'ship',kind:'transport',position:{x:46,y:30}}];
 for(let i=0;i<6;i++)g.units.push({...structuredClone(base),id:`troop-${i}`,position:{x:50,y:30}});
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);return g;
}
test('Empty transport approaches a beach and loads its troops without a port, with replay',()=>{
 let g=beach(),replay=importSave(exportSave(g));
 for(let i=0;i<4;i++){g=playRedOpponent(g);replay=playRedOpponent(replay);assert.deepEqual(g,replay);g=endTurn(endTurn(g));replay=endTurn(endTurn(replay));}
 assert.equal(g.units.filter(u=>u.aboard==='ship').length,6);assert.ok(g.events.some(e=>e.message.includes('boarded ship')));
});
test('Threats, unknown routes, sentries and protected troops cannot supply a beach rendezvous',()=>{
 const g=beach(),v=getPlayerView(g,'red'),ship=v.ownUnits[0],before=structuredClone(v);
 assert.ok(planAiBeachPickup(v,ship));assert.deepEqual(v,before);
 assert.equal(planAiBeachPickup(v,ship,new Set(v.ownUnits.map(u=>u.id))),null);
 for(const u of v.ownUnits.filter(u=>u.kind==='army'))u.order={kind:'sentry'};assert.equal(planAiBeachPickup(v,ship),null);
 for(const u of v.ownUnits)u.order={kind:'none'};
 v.enemies.push({id:'enemy',kind:'army',owner:'blue',position:{x:51,y:30},stale:false});assert.equal(planAiBeachPickup(v,ship),null);
 v.enemies=[];for(const c of v.cells)if(c.terrain==='sea')c.terrain=null;assert.equal(planAiBeachPickup(v,ship),null);
});
test('Armies with a reachable land objective continue their assault instead of awaiting pickup',()=>{
 const g=beach(),v=getPlayerView(g,'red');v.cells[30*v.width+55].city={id:'target',owner:null};
 assert.equal(planAiBeachPickup(v,v.ownUnits[0]),null);
});
test('Inland armies march to a beach and the ship waits to finish pickup, with replay',()=>{
 let g=beach();g.units=g.units.filter(u=>u.kind==='transport'||['troop-0','troop-1'].includes(u.id));
 for(let y=28;y<=34;y++)for(let x=50;x<=56;x++)g.tiles[y*g.width+x]='land';
 g.units.find(u=>u.id==='troop-0').position={x:53,y:30};g.units.find(u=>u.id==='troop-1').position={x:53,y:31};
 g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);let replay=importSave(exportSave(g));
 let marched=false;
 for(let i=0;i<12;i++){
  g=playRedOpponent(g);replay=playRedOpponent(replay);assert.deepEqual(g,replay);
  if(g.units.some(u=>u.kind==='army'&&!u.aboard&&u.position.x<53))marched=true;
  if(g.units.filter(u=>u.aboard==='ship').length===2)break;
  g=endTurn(endTurn(g));replay=endTurn(endTurn(replay));
 }
 assert.ok(marched);assert.equal(g.units.filter(u=>u.aboard==='ship').length,2);assert.deepEqual(importSave(exportSave(g)),g);
});
test('Pickup deadline and invalid persisted reservations are enforced',()=>{
 const g=beach(),v=getPlayerView(g,'red'),ship=v.ownUnits[0];ship.aiPickup={armies:['troop-0','troop-1'],startedRound:1};v.round=13;
 assert.equal(planAiBeachPickup(v,ship),null);
 g.units[0].aiPickup={armies:['troop-0'],startedRound:g.round+1};assert.throws(()=>importSave(exportSave(g)),/pickup/);
});
test('Congestion cannot divert an army away from a connected land capture objective',()=>{
 const g=beach(),v=getPlayerView(g,'red');v.cells[30*v.width+55].city={id:'target',owner:null};
 for(let x=51;x<=54;x++)v.ownUnits.push({...structuredClone(v.ownUnits[1]),id:`block-${x}`,position:{x,y:30},order:{kind:'sentry'}});
 assert.equal(planAiBeachPickup(v,v.ownUnits[0]),null);
});
test('Completing a beach pickup does not return the loaded ship to an adjacent port',()=>{
 const g=beach();g.units=g.units.filter(u=>u.id==='ship'||['troop-0','troop-1'].includes(u.id));
 g.units[0].position={x:49,y:29};g.units[0].aiPickup={armies:['troop-0','troop-1'],startedRound:g.round};
 g.units.find(u=>u.id==='troop-1').position={x:50,y:29};g.tiles[29*g.width+50]='land';
 g.cities=[{id:'port',owner:'red',position:{x:48,y:29},production:'army',progress:0,firstCycle:true},
 {id:'target',owner:'blue',position:{x:60,y:35},production:null,progress:0,firstCycle:true}];
 for(const c of g.cities)g.tiles[c.position.y*g.width+c.position.x]='land';
 g.units.push({...structuredClone(g.units[1]),id:'guard',position:{x:48,y:29}});
 g.knowledge.red.terrain=[...g.tiles];g.knowledge.red.cities.target={id:'target',owner:'blue',production:null,productionKnown:false};updateAllKnowledge(g);
 const next=playRedOpponent(g);assert.equal(next.units.filter(u=>u.aboard==='ship').length,2);
 assert.notDeepEqual(next.units.find(u=>u.id==='ship').position,{x:48,y:29});
 assert.equal(next.units.find(u=>u.id==='ship').aiPickup,undefined);
 assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);assert.deepEqual(importSave(exportSave(next)),next);
});
