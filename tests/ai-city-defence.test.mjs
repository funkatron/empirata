import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,moveUnit,exportSave,importSave} from '../dist/engine/index.js';
function port(){
 const g=endTurn(makeRulesLab()),army=g.units.find(u=>u.id==='u3');army.position={x:80,y:36};
 g.units.push({...structuredClone(army),id:'troop'});
 g.units.push({...structuredClone(army),id:'ship',kind:'transport'});
 g.units.push({...structuredClone(army),id:'scout',kind:'destroyer',position:{x:84,y:36}});
 updateAllKnowledge(g);return g;
}
test('AI retains the city defender through explicit boarding and automatic port departure',()=>{
 const g=port(),next=playRedOpponent(g);
 assert.equal(next.units.find(u=>u.id==='u3').aboard,null);
 assert.deepEqual(next.units.find(u=>u.id==='u3').position,{x:80,y:36});
 assert.equal(next.units.find(u=>u.id==='troop').aboard,'ship');
 assert.notDeepEqual(next.units.find(u=>u.id==='ship').position,{x:80,y:36});
 assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);
 const manual=moveUnit(g,'ship',{x:81,y:36});
 assert.equal(manual.units.find(u=>u.id==='u3').aboard,'ship','Human auto-loading rules remain available');
});
test('An undefended city builds armies even when its connected region has large reserves',()=>{
 const g=port();g.units.find(u=>u.id==='u3').position={x:78,y:36};
 g.units.find(u=>u.id==='troop').position={x:77,y:36};
 for(let i=0;i<10;i++)g.units.push({...structuredClone(g.units[0]),id:`reserve-${i}`,owner:'red',position:{x:77,y:36}});
 updateAllKnowledge(g);
 assert.equal(playRedOpponent(g).cities.find(c=>c.id==='c-red').production,'army');
});
test('Empty transport capacity resumes army supply above the old eight-army threshold',()=>{
 const g=port(),base=g.units.find(u=>u.id==='troop');
 for(let i=0;i<7;i++)g.units.push({...structuredClone(base),id:`supply-${i}`,position:{x:79,y:36}});
 g.units.push({...structuredClone(g.units.find(u=>u.id==='scout')),id:'second-scout',position:{x:85,y:36}});
 g.units.push({...structuredClone(g.units.find(u=>u.id==='ship')),id:'second-ship',position:{x:86,y:36}});
 updateAllKnowledge(g);
 assert.equal(playRedOpponent(g).cities.find(c=>c.id==='c-red').production,'army');
});

test('Every occupied city retains its own defender while expedition troops can depart',()=>{
 const g=port(),second=g.cities.find(c=>c.id==='c2');second.owner='red';
 g.units.push({...structuredClone(g.units.find(u=>u.id==='u3')),id:'second-guard',position:{...second.position}});
 updateAllKnowledge(g);const next=playRedOpponent(g);
 for(const id of ['u3','second-guard']){
  assert.equal(next.units.find(u=>u.id===id).aboard,null);
  assert.deepEqual(next.units.find(u=>u.id===id).position,g.units.find(u=>u.id===id).position);
 }
});
