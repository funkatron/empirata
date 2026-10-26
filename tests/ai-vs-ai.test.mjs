import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAiVsAiLab,makeCloseQuartersLab,playBlueOpponent,advanceLabRound,
  getPlayerView,exportSave,importSave
} from '../dist/engine/index.js';

test('AI versus AI is a separate deterministic lab scenario',()=>{
  const g=makeAiVsAiLab();
  assert.equal(g.scenario,'ai-vs-ai');
  assert.equal(g.active,'blue');
  assert.equal(g.round,1);
  assert.ok(g.units.some(u=>u.owner==='blue'));
  assert.ok(g.units.some(u=>u.owner==='red'));
  assert.equal(makeCloseQuartersLab().scenario,'close-quarters');
});

test('Blue opponent preserves its own fog and never changes Red intelligence by observation',()=>{
  const g=makeAiVsAiLab();
  const redBefore=structuredClone(g.knowledge.red);
  const blueBefore=structuredClone(g.knowledge.blue);
  const result=playBlueOpponent(g);
  assert.deepEqual(g.knowledge.red,redBefore,'Source game remains immutable');
  assert.deepEqual(g.knowledge.blue,blueBefore,'Source game remains immutable');
  assert.equal(result.active,'blue');
  assert.deepEqual(result.players.map(p=>p.id),['blue','red']);
  assert.ok(result.units.some(u=>u.owner==='blue'));
  assert.ok(result.units.some(u=>u.owner==='red'));
  assert.ok(result.events.every(e=>e.recipient===null||e.recipient==='blue'||e.recipient==='red'));
  assert.ok(getPlayerView(result,'red').ownUnits.every(u=>u.owner==='red'));
  assert.ok(getPlayerView(result,'blue').ownUnits.every(u=>u.owner==='blue'));
});

test('Computer versus computer advances both factions and round counter',()=>{
  const before=makeAiVsAiLab();
  const after=advanceLabRound(before);
  assert.equal(before.round,1);
  assert.equal(after.round,2);
  assert.equal(after.active,'blue');
  assert.ok(after.events.length>before.events.length);
  assert.notDeepEqual(after,before);
});

test('Ten-round computer match is deterministic, including save/resume',()=>{
  let a=makeAiVsAiLab(),b=makeAiVsAiLab();
  for(let i=0;i<10;i++){
    a=advanceLabRound(a);
    if(i===4)b=importSave(exportSave(b));
    b=advanceLabRound(b);
    assert.deepEqual(b,a,`Round ${i+1} diverged`);
  }
  assert.equal(a.round,11);
  assert.equal(a.active,'blue');
});

test('Blue opponent rejects an opponent turn',()=>{
  const g=makeAiVsAiLab();
  g.active='red';
  assert.throws(()=>playBlueOpponent(g),/Blue AI/);
});
