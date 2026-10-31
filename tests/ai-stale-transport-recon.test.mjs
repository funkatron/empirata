import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,getPlayerView,updateAllKnowledge,planAiNavalTransportIntercept,playRedOpponent,exportSave,importSave} from '../dist/engine/index.js';
function report(kind){const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');g.units=[{...structuredClone(base),id:'scout',kind,position:{x:50,y:30}}];g.knowledge.red.terrain=[...g.tiles];g.knowledge.red.sightings=[{id:'old-transport',owner:'blue',kind:'transport',position:{x:56,y:30},observedRound:g.round}];updateAllKnowledge(g);return g;}
for(const kind of ['destroyer','submarine','cruiser','battleship'])test(`${kind} investigates a stale transport without inventing live combat`,()=>{
 const g=report(kind),v=getPlayerView(g,'red'),ship=v.ownUnits[0];assert.ok(v.enemies[0].stale);assert.equal(planAiNavalTransportIntercept(v,ship),null);assert.ok(planAiNavalTransportIntercept(v,ship,true));
 let next=playRedOpponent(g);assert.ok(next.units[0].position.x>50);assert.equal(next.events.some(e=>e.kind==='combat'),false);assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);
 for(let i=0;i<3;i++)next=playRedOpponent(endTurn(endTurn(next)));
 assert.equal(getPlayerView(next,'red').enemies.some(e=>e.id==='old-transport'),false,'Fresh observation clears the empty report');
});
test('A transport confirmed during investigation becomes a real interception target',()=>{
 let g=report('destroyer');g.units.push({...structuredClone(g.units[0]),id:'old-transport',owner:'blue',kind:'transport',position:{x:56,y:30}});updateAllKnowledge(g);
 for(let i=0;i<3;i++)g=endTurn(endTurn(playRedOpponent(g)));
 assert.ok(g.events.some(e=>e.kind==='combat'&&e.message.includes('old-transport')));
});
