import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,emptyKnowledge,getPlayerView,planAiFighterStep,exportSave,importSave} from '../dist/engine/index.js';
function carrier(){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');g.cities=[];
 g.units=[{...structuredClone(base),id:'cv',kind:'carrier',position:{x:40,y:30}},
 {...structuredClone(base),id:'air',kind:'fighter',position:{x:40,y:30},fuel:20,aboard:'cv'}];
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);updateAllKnowledge(g);return g;
}
test('AI carrier launches, recovers, refuels and launches a subsequent sortie with replay',()=>{
 let g=carrier(),replay=importSave(exportSave(g));const initial=getPlayerView(g,'red').cells.filter(c=>c.terrain!==null).length;
 let landed=false;
 for(let i=0;i<20;i++){
  g=playRedOpponent(g);replay=playRedOpponent(replay);assert.deepEqual(g,replay);
  const air=g.units.find(u=>u.id==='air');assert.ok(air,'Scout survives planned sortie');
  if(g.events.some(e=>e.message.includes('launched from'))&&air.aboard){landed=true;assert.equal(air.fuel,20);}
  g=endTurn(endTurn(g));replay=importSave(exportSave(endTurn(endTurn(replay))));
 }
 assert.ok(landed,'At least one completed carrier recovery');
 assert.ok(g.events.filter(e=>e.message.includes('launched from')).length>=2);
 assert.ok(getPlayerView(g,'red').cells.filter(c=>c.terrain!==null).length>initial);
});
test('Carrier keeps embarked scouts aboard when reconnaissance is exhausted or movement spent',()=>{
 const g=carrier();g.knowledge.red.terrain=[...g.tiles];
 assert.equal(playRedOpponent(g).units.find(u=>u.id==='air').aboard,'cv');
 const spent=carrier();spent.units[1].spent=5;
 assert.equal(playRedOpponent(spent).units[1].aboard,'cv');
});
test('Airborne fighter cannot plan its return to a full or destroyed carrier',()=>{
 const g=carrier();g.units[1].aboard=null;g.units[1].position={x:42,y:30};g.units[1].fuel=5;
 for(let i=0;i<8;i++)g.units.push({...structuredClone(g.units[1]),id:`cargo-${i}`,aboard:'cv',position:{x:40,y:30}});
 updateAllKnowledge(g);assert.equal(planAiFighterStep(getPlayerView(g,'red'),g.units[1]),null);
 g.units=g.units.filter(u=>u.id==='air');updateAllKnowledge(g);
 assert.equal(planAiFighterStep(getPlayerView(g,'red'),g.units[0]),null);
});
