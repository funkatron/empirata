import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAiVsAiLab,makeCloseQuartersLab,playBlueOpponent,advanceLabRound,
  getPlayerView,exportSave,importSave,repairLabHarbor,updateAllKnowledge
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

test('Blue AI does not use an undiscovered rival city as a target',()=>{
  const a=makeAiVsAiLab(),b=structuredClone(a);
  b.cities.push({id:'secret-red-base',position:{x:48,y:47},owner:'red',
    production:null,progress:0,firstCycle:true});
  assert.deepEqual(getPlayerView(a,'blue'),getPlayerView(b,'blue'));
  const left=playBlueOpponent(a),right=playBlueOpponent(b);
  const blueUnits=g=>g.units.filter(u=>u.owner==='blue');
  assert.deepEqual(blueUnits(left),blueUnits(right));
  assert.deepEqual(left.rng,right.rng);
});

test('A twenty-round AI exhibition never strands cargo or leaves the active faction invalid',()=>{
  let g=makeAiVsAiLab();
  for(let i=0;i<20;i++){
    g=advanceLabRound(g);
    assert.equal(g.round,i+2);
    assert.equal(g.active,'blue');
    for(const cargo of g.units.filter(u=>u.aboard)){
      const ship=g.units.find(u=>u.id===cargo.aboard);
      assert.ok(ship,`Orphan cargo ${cargo.id} at round ${g.round}`);
      assert.equal(ship.owner,cargo.owner);
      assert.deepEqual(ship.position,cargo.position);
    }
  }
});

test('The eastern computer harbor connects to open ocean in a new match',()=>{
  const g=makeAiVsAiLab();
  assert.equal(g.tiles[36*g.width+81],'sea');
  const seen=new Set([36*g.width+81]),queue=[36*g.width+81];
  for(let i=0;i<queue.length;i++){
    const p=queue[i],x=p%g.width,y=Math.floor(p/g.width);
    for(const [dx,dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
      const nx=x+dx,ny=y+dy,k=ny*g.width+nx;
      if(nx<=0||ny<=0||nx>=g.width-1||ny>=g.height-1||seen.has(k)||g.tiles[k]!=='sea')continue;
      seen.add(k);queue.push(k);
    }
  }
  assert.ok([...seen].some(k=>k%g.width>=94),'Eastern port must reach open sea');
});

test('Legacy computer saves repair their isolated harbor without drowning land units',()=>{
  const old=makeCloseQuartersLab();
  old.scenario='ai-vs-ai';
  const army=old.units.find(u=>u.owner==='red'&&u.kind==='army');
  army.position={x:82,y:36};
  updateAllKnowledge(old);
  const original=structuredClone(old);
  const fixed=repairLabHarbor(old);
  assert.equal(old.tiles[36*old.width+82],'land','Repair must not mutate save input');
  assert.equal(fixed.tiles[36*fixed.width+82],'land','Ground units must remain on land');
  assert.ok(fixed.events.some(e=>e.message.includes('Lab harbor repaired')));
  assert.deepEqual(repairLabHarbor(fixed),fixed,'Repair must be idempotent');
  assert.deepEqual(old,original);
  const advanced=advanceLabRound(importSave(exportSave(old)));
  assert.ok(advanced.events.some(e=>e.message.includes('Lab harbor repaired')));
});
