import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,updateAllKnowledge,getPlayerView,planAiNavalTransportIntercept,playRedOpponent,moveUnit,exportSave,importSave} from '../dist/engine/index.js';
function fixture(kind='destroyer'){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');
 for(const c of g.cities)g.tiles[c.position.y*g.width+c.position.x]='land';
 g.units=[{...structuredClone(base),id:'hunter',kind,position:{x:50,y:30}},
 {...structuredClone(base),id:'prey',kind:'transport',owner:'blue',position:{x:51,y:30}}];
 g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);return g;
}
for(const kind of ['destroyer','submarine','cruiser','battleship'])test(`${kind} attacks a newly detected transport through normal combat`,()=>{
 const g=fixture(kind),v=getPlayerView(g,'red');assert.deepEqual(planAiNavalTransportIntercept(v,v.ownUnits[0]),{x:51,y:30});
 const before=structuredClone(g),next=playRedOpponent(g);
 assert.ok(next.events.some(e=>e.kind==='combat'&&e.message.includes('prey')));
 assert.deepEqual(g,before);assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);
 assert.deepEqual(importSave(exportSave(next)),next);
});
test('Interception routes around charted land to a reachable transport before scouting',()=>{
 const g=fixture(),v=getPlayerView(g,'red');v.enemies[0].position={x:54,y:30};
 for(let y=29;y<=31;y++)v.cells[y*v.width+51].terrain='land';
 const before=structuredClone(v),step=planAiNavalTransportIntercept(v,v.ownUnits[0]);
 assert.ok(step);assert.equal(step.x,50);assert.ok(step.y!==30);assert.deepEqual(v,before);
});
test('Unknown water, occupied cells and hostile cities cannot become interception corridors',()=>{
 const g=fixture(),v=getPlayerView(g,'red');v.enemies[0].position={x:53,y:30};
 for(const d of [{x:-1,y:-1},{x:0,y:-1},{x:1,y:-1},{x:-1,y:0},{x:1,y:0},{x:-1,y:1},{x:0,y:1},{x:1,y:1}])v.cells[(30+d.y)*v.width+50+d.x].terrain='land';
 const p=v.cells[30*v.width+51];p.terrain=null;assert.equal(planAiNavalTransportIntercept(v,v.ownUnits[0]),null);
 p.terrain='sea';v.ownUnits.push({...structuredClone(v.ownUnits[0]),id:'blocker',position:{x:51,y:30}});assert.equal(planAiNavalTransportIntercept(v,v.ownUnits[0]),null);
 v.ownUnits.pop();p.terrain='land';p.city={id:'hostile-port',owner:'blue'};assert.equal(planAiNavalTransportIntercept(v,v.ownUnits[0]),null);
});
test('A stale transport report never initiates hunter pursuit',()=>{
 const g=fixture(),v=getPlayerView(g,'red');v.enemies[0].stale=true;
 assert.equal(planAiNavalTransportIntercept(v,v.ownUnits[0]),null);
});
test('An unreachable nearby contact does not hide a reachable transport',()=>{
 const g=fixture(),v=getPlayerView(g,'red');v.enemies[0].position={x:53,y:30};
 for(let y=29;y<=31;y++)for(let x=52;x<=54;x++)v.cells[y*v.width+x].terrain='land';v.cells[30*v.width+53].terrain='sea';
 v.enemies.push({...structuredClone(v.enemies[0]),id:'reachable',position:{x:50,y:34}});
 const step=planAiNavalTransportIntercept(v,v.ownUnits[0]);assert.ok(step);assert.equal(step.y,31);
});
for(const kind of ['transport','carrier','army','fighter'])test(`${kind} does not receive the naval hunter role`,()=>{
 const g=fixture(kind),v=getPlayerView(g,'red');assert.equal(planAiNavalTransportIntercept(v,v.ownUnits[0]),null);
});

test('A destroyer pursues a transport detected by another unit and attacks this turn',()=>{
 const g=fixture(),base=g.units[0];g.units.find(u=>u.id==='prey').position={x:53,y:30};
 g.units.push({...structuredClone(base),id:'observer',kind:'army',position:{x:53,y:31}});g.tiles[31*g.width+53]='land';
 updateAllKnowledge(g);assert.ok(getPlayerView(g,'red').enemies.some(e=>e.id==='prey'&&!e.stale));
 const next=playRedOpponent(g);assert.ok(next.events.some(e=>e.kind==='combat'&&e.message.includes('prey')));
});

for(const kind of ['cruiser','battleship'])test(`${kind} preserves coastal bombardment while assigned naval duties`,()=>{
 const g=fixture(kind),prey=g.units.find(u=>u.id==='prey');prey.kind='army';g.tiles[30*g.width+51]='land';updateAllKnowledge(g);
 const manual=moveUnit(g,'hunter',prey.position);assert.ok(manual.events.some(e=>e.kind==='combat'));
 const next=playRedOpponent(g);assert.ok(next.events.some(e=>e.kind==='combat'&&e.message.includes('prey')));
 assert.deepEqual(next.units.find(u=>u.id==='hunter')?.position,{x:50,y:30});
 assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);
});
test('Interceptors traverse a guarded friendly canal city using legal stacking',()=>{
 const g=fixture(),hunter=g.units.find(u=>u.id==='hunter');g.tiles.fill('land');
 for(const x of [50,52,53])g.tiles[30*g.width+x]='sea';
 g.units.find(u=>u.id==='prey').position={x:53,y:30};
 g.cities.push({id:'canal',owner:'red',position:{x:51,y:30},production:null,progress:0,firstCycle:true});
 g.units.push({...structuredClone(hunter),id:'guard',kind:'army',position:{x:51,y:30}},
 {...structuredClone(hunter),id:'observer',kind:'army',position:{x:52,y:31}});
 g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);
 const view=getPlayerView(g,'red');assert.deepEqual(planAiNavalTransportIntercept(view,hunter),{x:51,y:30});
 const inPort=moveUnit(g,hunter.id,{x:51,y:30}),ship=inPort.units.find(u=>u.id===hunter.id);
 assert.deepEqual(planAiNavalTransportIntercept(getPlayerView(inPort,'red'),ship),{x:52,y:30});
 assert.deepEqual(moveUnit(inPort,ship.id,{x:52,y:30}).units.find(u=>u.id===ship.id).position,{x:52,y:30});
});
