import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,getPlayerView,aiLocalArmyReserve,updateAllKnowledge,endTurn,playRedOpponent} from '../dist/engine/index.js';

function inland(){
 const g=makeRulesLab(),army=g.units.find(u=>u.id==='u3');
 g.units=g.units.filter(u=>u.owner!=='red');
 const city=g.cities.find(c=>c.id==='c-red');city.position={x:50,y:30};city.production='army';
 for(let y=26;y<=34;y++)for(let x=46;x<=54;x++)g.tiles[y*g.width+x]='land';
 for(let i=0;i<8;i++)g.units.push({...structuredClone(army),id:`reserve-${i}`,position:{x:48+i%4,y:29+Math.floor(i/4)}});
 updateAllKnowledge(g);return g;
}
test('Inland AI bounds reserves without a transport and resumes after local losses',()=>{
 let g=playRedOpponent(endTurn(inland()));
 assert.equal(g.cities.find(c=>c.id==='c-red').production,null);
 g.units=g.units.filter(u=>!u.id.startsWith('reserve-')||u.id==='reserve-0');
 g=playRedOpponent(g);
 assert.equal(g.cities.find(c=>c.id==='c-red').production,'army');
});
test('Remote reserves do not suppress a newly acquired isolated city factory',()=>{
 const g=inland();g.cities.push({id:'isolated',position:{x:60,y:45},owner:'red',production:null,progress:0,firstCycle:true});
 g.tiles[45*g.width+60]='land';updateAllKnowledge(g);
 const acted=playRedOpponent(endTurn(g));
 assert.equal(acted.cities.find(c=>c.id==='isolated').production,'army');
});
test('Reserve accounting ignores occupancy and cannot traverse unknown land',()=>{
 const g=inland(),view=getPlayerView(endTurn(g),'red');
 assert.equal(aiLocalArmyReserve(view,{x:50,y:30}),8);
 const remote=structuredClone(view.ownUnits[0]);remote.id='remote';remote.position={x:60,y:45};view.ownUnits.push(remote);
 assert.equal(aiLocalArmyReserve(view,{x:50,y:30}),8);
 for(const cell of view.cells){cell.terrain=null;cell.city=null;}
 view.cells[30*view.width+50].terrain='land';
 assert.equal(aiLocalArmyReserve(view,{x:50,y:30}),1,'Only the army on the city square remains connected');
});
