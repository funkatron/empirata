import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,emptyKnowledge,updateAllKnowledge,getPlayerView,planAiCoastalSentryStep,playRedOpponent,exportSave,importSave} from '../dist/engine/index.js';
const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
function coast(kind='destroyer'){
 const g=endTurn(makeRulesLab()),base=structuredClone(g.units.find(u=>u.owner==='red'));g.tiles.fill('sea');
 for(let y=30;y<=35;y++)for(let x=45;x<=55;x++)g.tiles[y*g.width+x]='land';
 g.cities=[{id:'home',owner:'red',position:{x:50,y:30},production:'army',progress:0,firstCycle:true}];
 g.units=[{...base,id:'guard',position:{x:50,y:30}},{...base,id:'sentry',kind,position:{x:2,y:2}}];
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);return g;
}
for(const kind of ['destroyer','submarine','cruiser','battleship'])test(`${kind} leaves an idle corner and holds a coastal sentry station`,()=>{
 let g=coast(kind),replay=importSave(exportSave(g));
 for(let i=0;i<35;i++){g=playRedOpponent(g);replay=playRedOpponent(replay);assert.deepEqual(g,replay);g=endTurn(endTurn(g));replay=endTurn(endTurn(replay));}
 const ship=g.units.find(u=>u.id==='sentry'),v=getPlayerView(g,'red');
 assert.ok(ship.position.x>2);assert.ok(distance(ship.position,g.cities[0].position)<=4);assert.ok(distance(ship.position,g.cities[0].position)>1,'Keep port entrances clear');
 assert.equal(planAiCoastalSentryStep(v,ship),null);assert.deepEqual(playRedOpponent(g).units.find(u=>u.id===ship.id).position,ship.position);
 assert.equal(ship.order.kind,'none','Duty remains reassessable rather than a permanent order');
});
test('Coastal sentries spread along landmass edges instead of stacking at the same port',()=>{
 let g=coast();g.units.find(u=>u.id==='sentry').position={x:47,y:29};
 g.units.push({...structuredClone(g.units.find(u=>u.id==='sentry')),id:'second',position:{x:47,y:27}});updateAllKnowledge(g);
 for(let i=0;i<8;i++)g=endTurn(endTurn(playRedOpponent(g)));
 const ships=g.units.filter(u=>u.kind==='destroyer');assert.ok(distance(ships[0].position,ships[1].position)>3);
 const before=ships.map(u=>u.position),next=playRedOpponent(g);assert.deepEqual(next.units.filter(u=>u.kind==='destroyer').map(u=>u.position),before);
});
test('A coastal sentry intercepts a newly detected transport immediately',()=>{
 const g=coast();g.units.find(u=>u.id==='sentry').position={x:47,y:29};
 g.units.push({...structuredClone(g.units[1]),id:'enemy-transport',owner:'blue',kind:'transport',position:{x:46,y:29}});updateAllKnowledge(g);
 assert.ok(playRedOpponent(g).events.some(e=>e.kind==='combat'&&e.message.includes('enemy-transport')));
});
test('Unknown shoreline and map borders do not create coastal sentry destinations',()=>{
 const g=coast(),v=getPlayerView(g,'red'),ship=v.ownUnits.find(u=>u.id==='sentry');
 for(const c of v.cells)if(c.terrain==='land')c.terrain=null;
 for(let y=0;y<v.height;y++)v.cells[y*v.width].terrain='land';
 const before=structuredClone(v);assert.equal(planAiCoastalSentryStep(v,ship),null);assert.deepEqual(v,before);
});

test('Fresh enemies and remembered hostile cities prevent treating a landmass as clear',()=>{
 const g=coast(),v=getPlayerView(g,'red'),ship=v.ownUnits.find(u=>u.id==='sentry');
 v.enemies.push({id:'invader',kind:'army',owner:'blue',position:{x:50,y:33},stale:false});
 assert.equal(planAiCoastalSentryStep(v,ship),null);
 v.enemies[0].stale=true;assert.ok(planAiCoastalSentryStep(v,ship),'A stale unit report is not proof of a present army');
 v.cells[33*v.width+50].city={id:'enemy-city',owner:'blue'};assert.equal(planAiCoastalSentryStep(v,ship),null);
});
test('Perimeter duty selects a different friendly landmass when enemies occupy the first',()=>{
 const g=coast(),v=getPlayerView(g,'red'),ship=v.ownUnits.find(u=>u.id==='sentry');ship.position={x:47,y:29};
 v.enemies.push({id:'invader',kind:'army',owner:'blue',position:{x:50,y:33},stale:false});
 for(let y=20;y<=24;y++)for(let x=70;x<=74;x++)v.cells[y*v.width+x].terrain='land';
 const remote={id:'remote',owner:'red',position:{x:70,y:22}};v.ownCities.push(remote);v.cells[22*v.width+70].city={id:'remote',owner:'red'};
 for(let i=0;i<80;i++){const next=planAiCoastalSentryStep(v,ship);if(!next)break;ship.position=next;}
 assert.ok(distance(ship.position,remote.position)<=4);assert.ok(distance(ship.position,g.cities[0].position)>4);
});
