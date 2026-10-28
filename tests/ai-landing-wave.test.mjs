import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAiInvasionLab,getPlayerView,planAiLandingWave,playRedOpponent,updateAllKnowledge,exportSave,importSave} from '../dist/engine/index.js';

function fixture(){
  const g=makeAiInvasionLab();
  g.active='red';
  const ship=g.units.find(u=>u.id==='red-transport');
  ship.position={x:76,y:30};ship.aiObjective='invasion-outpost';
  const army=g.units.find(u=>u.id==='u3');
  army.position={...ship.position};
  const view=getPlayerView(g,'red');
  view.ownUnits=structuredClone(g.units.filter(u=>u.owner==='red'));
  for(let y=28;y<=30;y++)for(let x=73;x<=75;x++)
    view.cells[y*view.width+x]={terrain:'land',visible:true,city:null};
  view.cells[29*view.width+74].city={id:ship.aiObjective,owner:'blue',production:null,productionKnown:false};
  view.enemies=[{id:'defender',owner:'blue',kind:'army',position:{x:73,y:29},stale:false}];
  return {g,view,ship: view.ownUnits.find(u=>u.id===ship.id)};
}
function cargo(view,ship,id){
  view.ownUnits.push({...structuredClone(view.ownUnits.find(u=>u.id==='u3')),id,aboard:ship.id,position:{...ship.position}});
}

test('Landing wave holds a lone army against a freshly observed defender',()=>{
  const {view}=fixture();
  assert.deepEqual(planAiLandingWave(view),[]);
});

test('Landing wave reserves distinct safe squares for a sufficient ready force',()=>{
  const {view,ship}=fixture();cargo(view,ship,'second');
  const wave=planAiLandingWave(view);
  assert.equal(wave.length,2);
  assert.equal(new Set(wave.map(o=>`${o.to.x},${o.to.y}`)).size,2);
  assert.ok(wave.every(o=>o.to.x===75),'Both armies use the safe side of the island');
  view.ownUnits.find(u=>u.id==='second').spent=1;
  assert.deepEqual(planAiLandingWave(view),[],'Spent cargo cannot count toward a wave');
});

test('Nearby transports combine forces for the same objective',()=>{
  const {view,ship}=fixture();
  const second={...structuredClone(ship),id:'second-ship',position:{x:76,y:28}};
  view.ownUnits.push(second);cargo(view,second,'second');
  assert.equal(planAiLandingWave(view).length,2);
  second.aiObjective='another-city';
  assert.deepEqual(planAiLandingWave(view),[],'Separate missions cannot inflate landing strength');
});

test('Shared beach assignment preserves the only square reachable by a second ship',()=>{
  const {view,ship}=fixture();
  const second={...structuredClone(ship),id:'second-ship',position:{x:76,y:28}};
  view.ownUnits.push(second);cargo(view,second,'second');
  view.ownUnits.push({...structuredClone(ship),id:'blocking-ship',kind:'destroyer',position:{x:75,y:28}});
  const wave=planAiLandingWave(view);
  assert.deepEqual(wave.find(o=>o.armyId==='second').to,{x:75,y:29});
  assert.deepEqual(wave.find(o=>o.armyId==='u3').to,{x:75,y:30});
});

test('A narrow beach does not cause a piecemeal landing',()=>{
  const {view,ship}=fixture();cargo(view,ship,'second');
  view.cells[28*view.width+75].terrain='sea';
  view.cells[30*view.width+75].terrain='sea';
  assert.deepEqual(planAiLandingWave(view),[]);
});

test('Stale defenders do not impose a permanent strength requirement',()=>{
  const {view}=fixture();view.enemies[0].stale=true;
  assert.equal(planAiLandingWave(view).length,1);
});

test('Nearby landed support counts only when it can reach the same objective',()=>{
  const {view}=fixture();
  const support={...structuredClone(view.ownUnits.find(u=>u.id==='u3')),id:'support',aboard:null,position:{x:75,y:28}};
  view.ownUnits.push(support);
  assert.equal(planAiLandingWave(view).length,1);
  support.position={x:77,y:28};view.cells[28*view.width+77].terrain='land';
  assert.deepEqual(planAiLandingWave(view),[],'A disconnected island provides no support');
});

test('AI executes a simultaneous landing wave and preserves current-version replay',()=>{
  const {g,view}=fixture();
  // Materialize this small intelligence fixture as an actual, visible beach.
  for(let y=28;y<=30;y++)for(let x=73;x<=75;x++)g.tiles[y*g.width+x]='land';
  g.units.push({...structuredClone(g.units.find(u=>u.id==='u3')),id:'second',spent:0});
  g.units.push({...structuredClone(g.units.find(u=>u.id==='u3')),id:'defender',owner:'blue',aboard:null,position:{x:73,y:29}});
  g.units.push({...structuredClone(g.units.find(u=>u.id==='red-transport')),id:'scout',kind:'destroyer',
    position:{x:72,y:28},aboard:null});
  delete g.units.find(u=>u.id==='scout').aiObjective;
  g.knowledge.red.terrain=view.cells.map(c=>c.terrain);
  updateAllKnowledge(g);
  const result=playRedOpponent(g);
  assert.deepEqual(playRedOpponent(importSave(exportSave(g))),result);
  assert.equal(result.units.filter(u=>['u3','second'].includes(u.id)&&!u.aboard).length,2);
  assert.ok(result.units.filter(u=>['u3','second'].includes(u.id)).every(u=>u.spent===1));
  g.units=g.units.filter(u=>u.id!=='second');
  const held=playRedOpponent(g);
  assert.equal(held.units.find(u=>u.id==='u3').aboard,'red-transport');
  assert.deepEqual(held.units.find(u=>u.id==='red-transport').position,{x:76,y:30});
});
