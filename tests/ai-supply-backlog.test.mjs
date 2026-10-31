import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,emptyKnowledge} from '../dist/engine/index.js';
function ports(){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');g.cities=[];g.units=[];
 for(const [id,x] of [['empty',30],['supplied',40]]){
  g.tiles[30*g.width+x]='land';g.cities.push({id,owner:'red',position:{x,y:30},production:'army',progress:0,firstCycle:true});
  g.units.push({...structuredClone(base),id:`guard-${id}`,position:{x,y:30}});
 }
 for(let i=0;i<8;i++)g.units.push({...structuredClone(base),id:`troop-${i}`,position:{x:40,y:30}});
 g.units.push({...structuredClone(base),id:'ship',kind:'transport',position:{x:30,y:30}});
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 g.knowledge.red.terrain=[...g.tiles];updateAllKnowledge(g);return g;
}
test('Empty transport leaves a barren port for troops instead of waiting indefinitely',()=>{
 const g=ports(),next=playRedOpponent(g);assert.ok(next.units.find(u=>u.id==='ship').position.x>30);
});
test('Fighter production is not blocked by empty transport capacity',()=>{
 const g=ports();g.knowledge.red.terrain.fill(null);updateAllKnowledge(g);
 g.units.push({...structuredClone(g.units.find(u=>u.id==='ship')),id:'extra-transport',position:{x:42,y:30}});
 updateAllKnowledge(g);assert.equal(playRedOpponent(g).cities.find(c=>c.id==='supplied').production,'fighter');
});
test('Returned transport actually picks up reserve armies through normal turns',()=>{
 let g=ports();for(let i=0;i<8;i++)g=playRedOpponent(endTurn(endTurn(g)));
 assert.ok(g.events.some(e=>/boarded ship|loaded aboard ship/.test(e.message)));
 assert.ok(g.units.find(u=>u.id==='guard-supplied').aboard===null);
});
