import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAiVsAiSkirmishLab as makeAiVsAiLab,makeCloseQuartersLab,playBlueOpponent,advanceLabRound,
  getPlayerView,exportSave,importSave,updateAllKnowledge
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


test('A loaded Red transport can depart the generated eastern harbor',()=>{
  const g=makeAiVsAiLab();
  const template=g.units.find(u=>u.owner==='red'&&u.kind==='army');
  const ship={...structuredClone(template),id:'test-ship',kind:'transport',
    position:{x:81,y:36},aboard:null,fuel:null,spent:0,order:{kind:'none'}};
  const cargo={...structuredClone(template),id:'test-cargo',
    position:{x:81,y:36},aboard:'test-ship',spent:0,order:{kind:'none'}};
  g.units.push(ship,cargo);
  updateAllKnowledge(g);
  const after=advanceLabRound(g);
  const moved=after.units.find(u=>u.id==='test-ship');
  assert.notDeepEqual(moved.position,ship.position,'Loaded transport must sail out of port');
  assert.deepEqual(after.units.find(u=>u.id==='test-cargo').position,moved.position);
});

test('Autonomous match tracks production, embarkation and real sea travel within 150 rounds',()=>{
  let g=makeAiVsAiLab();
  const produced={blue:new Set(),red:new Set()};
  const loaded={blue:false,red:false};
  const voyages={blue:new Map(),red:new Map()};
  // A valid beach can now shorten the crossing. Require actual loaded movement,
  // not an arbitrary three-cell route; the dedicated overseas campaign still
  // checks its longer crossing and capture end to end.
  const initial=new Set(g.units.map(u=>u.id));
  const firstRound={blue:null,red:null};
  // Fuel losses change production timing; retain a bounded voyage requirement.
  for(let i=0;i<150;i++){
    const departure=new Map(g.units.filter(u=>u.kind==='transport'&&u.order.kind==='none').map(u=>[u.id,{...u.position}]));
    g=advanceLabRound(g);
    for(const side of ['blue','red']){
      for(const unit of g.units.filter(u=>u.owner===side)){
        if(!initial.has(unit.id))produced[side].add(unit.id);
        if(unit.kind!=='transport')continue;
        const cargo=g.units.filter(u=>u.aboard===unit.id);
        if(!cargo.length)continue;
        loaded[side]=true;
        const visited=voyages[side].get(unit.id)??new Set();
        // AI loading precedes discretionary movement. Include the departure
        // square so a crossing completed within one turn remains observable.
        const from=departure.get(unit.id);
        if(from)visited.add(from.y*g.width+from.x);
        visited.add(unit.position.y*g.width+unit.position.x);
        voyages[side].set(unit.id,visited);
        if(visited.size>=2&&firstRound[side]===null)firstRound[side]=g.round;
      }
    }
    for(const cargo of g.units.filter(u=>u.aboard)){
      const ship=g.units.find(u=>u.id===cargo.aboard);
      assert.ok(ship,'No orphan cargo at round '+g.round);
      assert.deepEqual(cargo.position,ship.position);
    }
  }
  assert.ok(produced.red.size>0,'Red must produce units during an autonomous match');
  assert.ok(produced.blue.size>0,'Blue must produce units during an autonomous match');
  for(const side of ['blue','red']){
    assert.ok(loaded[side],side+' must load at least one transport');
    assert.ok(firstRound[side]!==null,
      side+' must change sea position while loaded; observed '+JSON.stringify({
        round:g.round,ships:[...voyages[side]].map(([id,cells])=>({id,visited:cells.size})),
        production:produced[side].size
      }));
  }
});
