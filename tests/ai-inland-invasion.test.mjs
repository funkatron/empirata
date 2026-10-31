import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,emptyKnowledge,getPlayerView,planAiInvasionStep,planAiLandingSquares,planAiConvoyStaging,exportSave,importSave} from '../dist/engine/index.js';
function inland(){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');
 for(let y=25;y<=35;y++)for(let x=45;x<=55;x++)g.tiles[y*g.width+x]='land';
 g.cities=[{id:'inland',owner:'blue',position:{x:50,y:30},production:null,progress:0,firstCycle:true}];
 g.units=[{...structuredClone(base),id:'ship',kind:'transport',position:{x:43,y:30},aiObjective:'inland'}];
 for(let i=0;i<3;i++)g.units.push({...structuredClone(base),id:`cargo-${i}`,position:{x:43,y:30},aboard:'ship'});
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 g.knowledge.red.terrain=[...g.tiles];g.knowledge.red.cities.inland={id:'inland',owner:'blue',production:null,productionKnown:false};g.rng={seed:1,draws:0};updateAllKnowledge(g);return g;
}
test('Transport lands on a connected coast beyond two squares and armies capture inland objective',()=>{
 let g=inland();const view=getPlayerView(g,'red'),ship=view.ownUnits[0];
 assert.deepEqual(planAiInvasionStep(view,ship),{x:44,y:29});
 ship.position={x:44,y:30};assert.ok(planAiLandingSquares(view,ship).some(p=>p.x===45));
 let replay=importSave(exportSave(g));
 for(let i=0;i<12&&g.cities[0].owner!=='red';i++){
  g=playRedOpponent(g);replay=playRedOpponent(replay);assert.deepEqual(g,replay);
  g=endTurn(endTurn(g));replay=endTurn(endTurn(replay));
 }
 assert.equal(g.cities[0].owner,'red');assert.ok(g.events.some(e=>e.message.includes('landed from ship')));
});
test('Unknown land gap cannot establish an inland invasion route',()=>{
 const g=inland(),view=getPlayerView(g,'red');
 for(let y=25;y<=35;y++)view.cells[y*view.width+47].terrain=null;
 const ship=view.ownUnits[0];ship.position={x:44,y:30};
 assert.deepEqual(planAiLandingSquares(view,ship),[]);
 const before=structuredClone(view);planAiInvasionStep(view,ship);assert.deepEqual(view,before);
});

test('Convoy staging recognizes a usable coast far from the inland city',()=>{
 const g=inland(),v=getPlayerView(g,'red'),ship=v.ownUnits[0];ship.position={x:44,y:30};
 v.cells[30*v.width+50].city=null;
 for(let y=25;y<=35;y++)for(let x=45;x<=60;x++)v.cells[y*v.width+x].terrain='land';
 v.cells[30*v.width+55].city={id:'inland',owner:'blue'};
 v.ownUnits.push({...structuredClone(ship),id:'partner',position:{x:34,y:30}},
 {...structuredClone(v.ownUnits[1]),id:'partner-cargo',aboard:'partner'});
 assert.ok(planAiConvoyStaging(v,ship));
});
for(const automatic of [false,true])test(`Ground assault troops remain ashore during ${automatic?'port departure':'nearby loading'}`,()=>{
 const g=inland(),base=g.units[1];g.cities.push({id:'supply',owner:'red',position:{x:45,y:30},production:'army',progress:0,firstCycle:true});
 g.units.push({...structuredClone(base),id:'guard',aboard:null,position:{x:45,y:30}});
 g.units.push({...structuredClone(base),id:'assault',aboard:null,aiBeachhead:'inland',position:{x:45,y:automatic?30:29}});
 g.units[0].position={x:automatic?45:44,y:30};for(const u of g.units.filter(u=>u.aboard==='ship'))u.position={...g.units[0].position};
 updateAllKnowledge(g);const next=playRedOpponent(g),army=next.units.find(u=>u.id==='assault');
 assert.equal(army.aboard,null);assert.deepEqual(importSave(exportSave(next)),next);assert.notDeepEqual(army.position,g.units.find(u=>u.id==='assault').position,'Ground assault advances instead of remaining reserved');
});
