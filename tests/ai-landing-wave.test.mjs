import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAiInvasionLab,getPlayerView,planAiLandingWave,planAiLandingSquares,
  endTurn,playRedOpponent,updateAllKnowledge,exportSave,importSave} from '../dist/engine/index.js';

function fleet(){
  const g=makeAiInvasionLab();
  const ship=g.units.find(u=>u.id==='red-transport');
  ship.position={x:75,y:30};ship.aiObjective='invasion-outpost';
  const army=g.units.find(u=>u.id==='u3');army.position={...ship.position};
  for(let x=73;x<=77;x++)g.tiles[29*g.width+x]='land';
  g.tiles[30*g.width+74]='land';
  for(let i=1;i<3;i++)g.units.push({...structuredClone(army),id:`cargo-${i}`});
  updateAllKnowledge(g);
  return g;
}
const wave=g=>planAiLandingWave(getPlayerView(g,'red'));

test('A hostile-city expedition waits for ready strength and unloads distinct beaches together',()=>{
  const g=fleet(),army=g.units.find(u=>u.id==='cargo-1');
  army.spent=1;
  assert.deepEqual(wave(g),[],'Two ready of three available armies should wait');
  army.spent=0;
  const initial=structuredClone(g),plan=wave(g);
  assert.equal(plan.length,3);
  assert.equal(new Set(plan.map(p=>JSON.stringify(p.position))).size,3);
  assert.deepEqual(g,initial);
  const acted=playRedOpponent(endTurn(g));
  for(const {armyId} of plan)assert.equal(acted.units.find(u=>u.id===armyId).aboard,null);
  assert.deepEqual(wave(importSave(exportSave(g))),plan);
});

test('Neutral objectives need two ready armies; a lone exploratory force can still land',()=>{
  const g=fleet(),view=getPlayerView(g,'red');
  view.cells[29*g.width+74].city.owner=null;
  view.ownUnits.find(u=>u.id==='cargo-1').spent=1;
  assert.equal(planAiLandingWave(view).length,2);
  view.ownUnits=view.ownUnits.filter(u=>!u.id.startsWith('cargo-'));
  assert.equal(planAiLandingWave(view).length,1);
});

test('Troops already ashore support a follow-up wave, but troops across a strait do not',()=>{
  const g=fleet();
  const first=g.units.find(u=>u.id==='cargo-1');first.aboard=null;first.position={x:76,y:29};
  g.units.find(u=>u.id==='cargo-2').spent=1;
  updateAllKnowledge(g);
  assert.equal(wave(g).length,0,'One ashore plus one ready is short of three');
  g.units.push({...structuredClone(g.units.find(u=>u.id==='cargo-2')),id:'waiting-reinforcement'});
  g.units.find(u=>u.id==='cargo-2').spent=0;
  assert.equal(wave(g).length,2);
  const view=getPlayerView(g,'red');
  view.ownUnits.find(u=>u.id===first.id).position={x:76,y:31};
  view.cells[31*g.width+76].terrain='land';
  assert.equal(planAiLandingWave(view).length,0,'Across-strait troops cannot make two ready armies count as three');
});

test('Nearby transports share a target and reserve beaches without stranding a constrained ship',()=>{
  const g=fleet(),view=getPlayerView(g,'red');
  view.ownUnits=view.ownUnits.filter(u=>u.id!=='cargo-2');
  const ship=view.ownUnits.find(u=>u.kind==='transport');
  view.ownUnits.push({...structuredClone(ship),id:'partner',position:{x:75,y:28}});
  const partner=view.ownUnits.find(u=>u.id==='cargo-1');
  partner.aboard='partner';partner.id='z-partner';
  // Both ships reach x=75,y=29; only the flexible ship reaches x=74,y=30.
  // It is matched first, so the second assignment must relocate it.
  view.cells[29*g.width+76].terrain='sea';
  const plan=planAiLandingWave(view);
  assert.equal(plan.length,2);
  assert.deepEqual(plan.find(p=>p.armyId==='z-partner').position,{x:75,y:29});
  assert.deepEqual(plan.find(p=>p.armyId==='u3').position,{x:74,y:30});
  view.ownUnits.find(u=>u.id==='z-partner').spent=1;
  assert.deepEqual(planAiLandingWave(view),[]);
});

test('Unsafe or occupied beaches and hostile city cells cannot inflate ready strength',()=>{
  const g=fleet(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.kind==='transport');
  assert.ok(!planAiLandingSquares(view,ship).some(p=>p.x===74&&p.y===29));
  view.enemies.push({id:'guard',kind:'army',owner:'blue',position:{x:77,y:28},stale:false});
  const safe=planAiLandingWave(view);
  assert.equal(safe.length,2,'Use the safe beach capacity rather than freeze the expedition');
  assert.ok(safe.every(p=>p.position.x!==76));
  view.enemies[0].stale=true;
  assert.equal(planAiLandingWave(view).length,3);
});
