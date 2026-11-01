import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,makeCloseQuartersLab,makeAiVsAiLab,emptyKnowledge,updateAllKnowledge,playAiOpponent,getPlayerView,planAiLandingSquares,exportSave,importSave} from '../dist/engine/index.js';
function flip(g){
 const n=structuredClone(g),side=f=>f==='blue'?'red':f==='red'?'blue':f;
 const message=s=>s.replace(/Blue|Red|BNS|RNS/g,t=>({Blue:'Red',Red:'Blue',BNS:'RNS',RNS:'BNS'}[t]));
 n.active=side(n.active);for(const p of n.players){p.id=side(p.id);p.label=message(p.label);}
 for(const c of n.cities)c.owner=side(c.owner);for(const u of n.units)u.owner=side(u.owner);
 [n.knowledge.blue,n.knowledge.red]=[n.knowledge.red,n.knowledge.blue];
 for(const k of Object.values(n.knowledge)){for(const s of k.sightings)s.owner=side(s.owner);for(const c of Object.values(k.cities))c.owner=side(c.owner);}
 for(const e of n.events){e.recipient=side(e.recipient);e.message=message(e.message);}return n;
}
function landing(){
 const g=makeRulesLab(),base=structuredClone(g.units.find(u=>u.owner==='red'));g.active='red';g.tiles.fill('sea');
 for(let y=25;y<=35;y++)for(let x=45;x<=55;x++)g.tiles[y*g.width+x]='land';
 g.cities=[{id:'target',owner:'blue',position:{x:50,y:30},production:null,progress:0,firstCycle:true}];
 g.units=[{...base,id:'ship',kind:'transport',position:{x:44,y:30},aiObjective:'target'}];
 for(let i=0;i<3;i++)g.units.push({...structuredClone(base),id:`cargo-${i}`,position:{x:44,y:30},aboard:'ship'});
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 g.knowledge.red.terrain=[...g.tiles];g.knowledge.red.cities.target={id:'target',owner:'blue',production:null,productionKnown:false};updateAllKnowledge(g);return g;
}
test('Blue and Red hostile invasions unload the same three armies on legal beaches',()=>{
 for(const g of [landing(),flip(landing())]){
  const view=getPlayerView(g,g.active),ship=view.ownUnits.find(u=>u.id==='ship');
  assert.ok(planAiLandingSquares(view,ship).length>0);
  assert.deepEqual(planAiLandingSquares({...view,active:g.active==='blue'?'red':'blue'},ship),planAiLandingSquares(view,ship),'Planning belongs to the viewed ship, even outside its turn');
  const next=playAiOpponent(g,g.active);
  assert.equal(next.units.filter(u=>u.id.startsWith('cargo-')&&!u.aboard).length,3);
  assert.deepEqual(importSave(exportSave(next)),next);
 }
});
test('Relabeling faction state relabels planner outcomes without changing decisions',()=>{
 for(const fixture of [makeCloseQuartersLab,makeAiVsAiLab,landing]){
  const g=fixture(),before=structuredClone(g),opposite=flip(g);
  const a=playAiOpponent(g,g.active),b=playAiOpponent(opposite,opposite.active);
  assert.deepEqual(flip(a),b);assert.deepEqual(g,before);
 }
});
