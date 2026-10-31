import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,getPlayerView,chooseAiTransportObjective} from '../dist/engine/index.js';
test('Ready troops commission transport capacity before additional scouting',()=>{
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red'),home=g.cities.find(c=>c.owner==='red');
 g.units=g.units.filter(u=>u.owner!=='red');
 for(let i=0;i<6;i++)g.units.push({...structuredClone(base),id:`army-${i}`,position:{...home.position}});
 updateAllKnowledge(g);assert.equal(playRedOpponent(g).cities.find(c=>c.id===home.id).production,'transport');
});
function fleet(){
 const g=endTurn(makeRulesLab()),view=getPlayerView(g,'red'),base=view.ownUnits[0];
 view.ownUnits=[];view.cells.forEach(c=>c.city=null);
 view.cells[20*view.width+50]={terrain:'land',visible:true,city:{id:'enemy',owner:'blue'}};
 view.cells[30*view.width+50]={terrain:'land',visible:true,city:{id:'neutral',owner:null}};
 for(let i=0;i<3;i++){
  view.ownUnits.push({...structuredClone(base),id:`ship-${i}`,kind:'transport',position:{x:30,y:20},aiObjective:'enemy'});
  view.ownUnits.push({...structuredClone(base),id:`army-${i}`,aboard:`ship-${i}`});
 }
 return view;
}
test('Larger invasion fleet keeps a neutral expedition without splitting the two-ship assault',()=>{
 const view=fleet(),ships=view.ownUnits.filter(u=>u.kind==='transport');
 for(const ship of ships)ship.aiObjective=chooseAiTransportObjective(view,ship);
 assert.equal(ships.filter(u=>u.aiObjective==='enemy').length,2);
 assert.equal(ships.filter(u=>u.aiObjective==='neutral').length,1);
 for(const ship of ships)assert.equal(chooseAiTransportObjective(view,ship),ship.aiObjective);
});
test('Two-ship force and ships already at the landing area retain their objectives',()=>{
 const view=fleet();view.ownUnits=view.ownUnits.filter(u=>u.id!=='ship-2'&&u.id!=='army-2');
 for(const ship of view.ownUnits.filter(u=>u.kind==='transport'))assert.equal(chooseAiTransportObjective(view,ship),'enemy');
 const landing=fleet();for(const u of landing.ownUnits)if(u.kind==='transport')u.position={x:49,y:20};
 for(const ship of landing.ownUnits.filter(u=>u.kind==='transport'))assert.equal(chooseAiTransportObjective(landing,ship),'enemy');
});
