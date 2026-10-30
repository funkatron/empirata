import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,emptyKnowledge,planAiFighterStep,getPlayerView,exportSave,importSave} from '../dist/engine/index.js';
function ready(carrier=false){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');
 for(let y=18;y<=24;y++)for(let x=18;x<=24;x++)g.tiles[y*g.width+x]='land';
 g.cities=[{id:'home',owner:'red',position:{x:carrier?24:21,y:21},production:null,progress:0,firstCycle:true}];
 g.units=Array.from({length:3},(_,i)=>({...structuredClone(base),id:`army-${i}`,position:{...g.cities[0].position}}));
 if(carrier)for(const [i,kind] of ['transport','destroyer','fighter','fighter'].entries())g.units.push({...structuredClone(base),id:`support-${i}`,kind,position:{x:25+i,y:21},fuel:kind==='fighter'?20:null});
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 if(carrier)g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);return g;
}
for(const kind of ['fighter','carrier'])test(`AI selects and normally completes ${kind} production`,()=>{
 let g=playRedOpponent(ready(kind==='carrier'));assert.equal(g.cities[0].production,kind);
 const replay=playRedOpponent(importSave(exportSave(ready(kind==='carrier'))));assert.deepEqual(g,replay);
 const turns=kind==='fighter'?12:48;
 for(let i=0;i<turns;i++)g=playRedOpponent(endTurn(endTurn(g)));
 assert.ok(g.events.some(e=>e.kind==='production'&&e.message.includes(`completed ${kind==='fighter'?'Fighter':'Carrier'}`)));
 assert.ok(g.units.some(u=>u.kind===kind));
});
test('Fighter scout returns to a friendly base before fuel runs out',()=>{
 const g=ready(),u={...structuredClone(g.units[0]),kind:'fighter',id:'air',position:{x:25,y:21},fuel:5};g.units.push(u);updateAllKnowledge(g);
 const next=planAiFighterStep(getPlayerView(g,'red'),u);assert.ok(next);assert.ok(next.x<25);
});
test('Missing city defender takes priority over aircraft production',()=>{
 const g=ready();for(const u of g.units)u.position={x:20,y:20};updateAllKnowledge(g);
 assert.equal(playRedOpponent(g).cities[0].production,'army');
});
