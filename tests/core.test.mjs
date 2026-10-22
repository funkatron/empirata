import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,MAP_WIDTH,MAP_HEIGHT,playable,inMap,terrainAt,STATS,UNIT_TYPES,requiredProductionTurns,
  isCoastal,selectProduction,advanceLabRound,moveUnit,movementAllowance,capacity,setOrder,
  getPlayerView,exportSave,importSave,nextRandom,updateAllKnowledge,RuleNotImplemented} from '../dist/engine/index.js';
const initial=()=>makeRulesLab();
function errCode(fn,code){assert.throws(fn,e=>e instanceof RuleNotImplemented&&e.code===code);}

test('T-001 map measures 100 columns by 60 rows, only interior traversable',()=>{
  const g=initial();assert.equal(g.width,MAP_WIDTH);assert.equal(g.height,MAP_HEIGHT);
  assert.equal(g.tiles.length,6000);assert.equal(playable(g,{x:0,y:3}),false);
  assert.equal(playable(g,{x:99,y:58}),false);assert.equal(playable(g,{x:98,y:58}),true);
  assert.equal(58*98,5684);
});
test('T-002 army diagonal move is one movement point, no more movement',()=>{
  const g=initial(),army=g.units.find(u=>u.kind==='army'&&u.owner==='blue');
  const moved=moveUnit(g,army.id,{x:10,y:26});
  assert.deepEqual(moved.units.find(u=>u.id===army.id).position,{x:10,y:26});
  assert.equal(moved.units.find(u=>u.id===army.id).spent,1);
  assert.throws(()=>moveUnit(moved,army.id,{x:11,y:27}),/No movement/);
  assert.deepEqual(g.units.find(u=>u.id===army.id).position,{x:9,y:25},'previous game state immutable');
});
test('T-003 destroyer can move three sea squares per turn',()=>{
  let g=initial();const u=g.units.find(u=>u.kind==='destroyer');
  for(const x of [6,5,4])g=moveUnit(g,u.id,{x,y:25});
  assert.equal(g.units.find(n=>n.id===u.id).spent,3);
  assert.throws(()=>moveUnit(g,u.id,{x:3,y:25}),/No movement/);
});
test('T-004 inland city cannot build battleship',()=>{
  let g=initial();g.cities[0].position={x:23,y:29};
  assert.equal(isCoastal(g,g.cities[0].position),false);
  assert.throws(()=>selectProduction(g,'c-blue','battleship'),/Inland/);
  assert.equal(selectProduction(g,'c-blue','army').cities[0].production,'army');
});
test('T-005 T-006 first army after six full blue production ticks, next after five',()=>{
  let g=selectProduction(initial(),'c-blue','army');
  const initialCount=g.units.filter(u=>u.owner==='blue'&&u.kind==='army').length;
  for(let t=0;t<5;t++){g=advanceLabRound(g);assert.equal(g.units.filter(u=>u.owner==='blue'&&u.kind==='army').length,initialCount);}
  assert.equal(g.cities[0].progress,5);
  g=advanceLabRound(g);assert.equal(g.units.filter(u=>u.owner==='blue'&&u.kind==='army').length,initialCount+1);
  assert.equal(g.cities[0].firstCycle,false);assert.equal(g.cities[0].progress,0);
  for(let t=0;t<5;t++)g=advanceLabRound(g);
  assert.equal(g.units.filter(u=>u.owner==='blue'&&u.kind==='army').length,initialCount+2);
});
test('T-007 production change resets progress, even after repeat cycle has begun',()=>{
  let g=selectProduction(initial(),'c-blue','army');
  for(let i=0;i<3;i++)g=advanceLabRound(g);
  assert.equal(g.cities[0].progress,3);
  g=selectProduction(g,'c-blue','fighter');
  assert.equal(g.cities[0].progress,0);assert.equal(g.cities[0].firstCycle,true);
  assert.equal(requiredProductionTurns('fighter',g.cities[0].firstCycle),12);
  assert.equal(selectProduction(g,'c-blue','fighter').cities[0].progress,0);
});
test('T-008 fighter burns movement fuel and crashes at 0 fuel away from owned city',()=>{
  let g=initial();
  const fighter={...structuredClone(g.units[0]),id:'trial',kind:'fighter',fuel:2,spent:0,position:{x:13,y:25}};
  g.units.push(fighter);updateAllKnowledge(g);
  g=moveUnit(g,'trial',{x:14,y:25});assert.equal(g.units.find(u=>u.id==='trial').fuel,1);
  g=moveUnit(g,'trial',{x:15,y:25});assert.equal(g.units.some(u=>u.id==='trial'),false);
  assert.equal(g.events.at(-1).kind,'fuel');
});
test('T-009 T-010 damaged ship capacities',()=>{
  const g=initial(),template=g.units[1];
  assert.equal(capacity({...template,kind:'carrier',damage:3}),5);
  assert.equal(capacity({...template,kind:'transport',damage:1}),4);
  assert.equal(capacity({...template,kind:'transport',damage:3}),0);
});
test('T-011 T-012 damaged ships have speed 1 and repair docked at start of turn',()=>{
  const g=initial();const ship=g.units[1];
  assert.equal(movementAllowance({...ship,kind:'cruiser',damage:3}),2);
  assert.equal(movementAllowance({...ship,kind:'cruiser',damage:4}),1);
  ship.position={x:8,y:25};ship.kind='battleship';ship.damage=3;
  const next=advanceLabRound(g);
  assert.equal(next.units.find(u=>u.id===ship.id).damage,2);
});
test('T-013 capture attempt is explicitly unavailable, not silently successful',()=>{
  let g=initial();g.cities.push({id:'neutral',position:{x:10,y:25},owner:null,production:null,progress:0,firstCycle:true});
  errCode(()=>moveUnit(g,'u1',{x:10,y:25}),'CITY_CAPTURE');
});
test('T-014 ship cannot enter ordinary land, bombardment not implemented',()=>{
  const g=initial();assert.throws(()=>moveUnit(g,'u2',{x:8,y:24}),/cannot cross/);
});
test('T-015 standing orders limited to implemented subset',()=>{
  const g=initial();errCode(()=>setOrder(g,'u1',{kind:'go-random'}),'STANDING_ORDERS');
});
test('T-016 sentry can be cleared and skip ends remaining movement for this turn',()=>{
  let g=setOrder(initial(),'u1',{kind:'sentry'});
  assert.throws(()=>moveUnit(g,'u1',{x:10,y:25}),/Clear sentry/);
  g=setOrder(g,'u1',{kind:'none'});g=setOrder(g,'u1',{kind:'skip'});
  assert.throws(()=>moveUnit(g,'u1',{x:10,y:25}),/No movement/);
  g=advanceLabRound(g);
  assert.equal(g.units.find(u=>u.id==='u1').order.kind,'none');
});
test('T-017 hostile contact is prohibited until combat is verified',()=>{
  const g=initial();g.units.push({...structuredClone(g.units[2]),id:'enemy-near',position:{x:10,y:25}});
  errCode(()=>moveUnit(g,'u1',{x:10,y:25}),'COMBAT');
});
test('T-018 unseen enemy units and cities not leaked into player view',()=>{
  const g=initial(),v=getPlayerView(g,'blue');
  const far=36*g.width+80;
  assert.equal(v.cells[far].terrain,null);
  assert.equal(v.cells[far].city,null);
  assert.equal(v.enemies.length,0);
  assert.equal(v.ownCities.length,1);
  assert.equal(v.events.every(e=>e.recipient==='blue'||e.recipient===null),true);
});
test('T-019 last seen enemy location remains stale after leaving vision',()=>{
  const g=initial();
  g.units[2].position={x:10,y:25};updateAllKnowledge(g);
  assert.equal(getPlayerView(g,'blue').enemies.length,1);
  g.units[0].position={x:12,y:30};
  g.units[2].position={x:72,y:36};updateAllKnowledge(g);
  const sight=getPlayerView(g,'blue').enemies[0];
  assert.equal(sight.position.x,10);assert.equal(sight.stale,true);
});
test('enemy reports disappear if old position is in current vision and empty',()=>{
  const g=initial();g.units[2].position={x:10,y:25};updateAllKnowledge(g);
  g.units[2].position={x:70,y:36};updateAllKnowledge(g);
  assert.equal(getPlayerView(g,'blue').enemies.length,0);
});
test('knowledge of enemy city production is not omniscient',()=>{
  const g=initial();g.cities[1].production='battleship';
  updateAllKnowledge(g);const v=getPlayerView(g,'blue');
  assert.equal(v.cells[36*100+80].city,null);
});
test('ship/air/land movement domain restrictions apply',()=>{
  const g=initial();g.units[0].position={x:8,y:25};
  assert.throws(()=>moveUnit(g,'u1',{x:7,y:25}),/cannot cross/);
  assert.throws(()=>moveUnit(g,'u2',{x:8,y:24}),/cannot cross/);
});
test('unit table contains exactly eight expected unit classes',()=>{
  assert.equal(UNIT_TYPES.length,8);
  assert.deepEqual([STATS.army.first,STATS.army.repeat,STATS.fighter.movement,STATS.battleship.hitPoints],[6,5,5,12]);
  assert.equal(STATS.submarine.hitDamage,3);
});
test('changing production does not mutate previous game',()=>{
  const g=initial();const changed=selectProduction(g,'c-blue','destroyer');
  assert.equal(g.cities[0].production,null);assert.equal(changed.cities[0].production,'destroyer');
});
test('serialization roundtrip keeps all critical fields, including knowledge',()=>{
  let g=selectProduction(initial(),'c-blue','fighter');g=advanceLabRound(g);
  const restored=importSave(exportSave(g));
  assert.deepEqual(restored,g);
  assert.equal(restored.ruleset,'interstel-2.05');
});
test('tampered ruleset, terrain dimensions, or efficiencies cannot import',()=>{
  const g=initial();for(const patch of [{ruleset:'empire-deluxe'},{width:44},{tiles:[]},
    {players:[{...g.players[0],productionEfficiency:75}]}])
    assert.throws(()=>importSave(JSON.stringify({...g,...patch})));
});
test('seeded random generator is deterministic and version-local',()=>{
  const a=nextRandom({seed:12,draws:0}),b=nextRandom({seed:12,draws:0});
  assert.deepEqual(a,b);assert.notEqual(a.value,nextRandom(a.next).value);
});
test('non-50% production remains unimplemented pending historical rounding verification',()=>{
  assert.throws(()=>requiredProductionTurns('army',true,75),/not verified/);
});
