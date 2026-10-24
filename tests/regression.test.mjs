import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab, nextRandom15, nextRandom, setOrder, runMoveToOrders, advanceLabRound, exportSave, importSave, updateAllKnowledge} from '../dist/engine/index.js';

const unit=(g,id='u1')=>g.units.find(u=>u.id===id);

test('Interstel seed-1 raw 15-bit generator matches recovered DOS vector',()=>{
  const expected=[41,18467,6334,26500,19169,15724,11478,29358,26962,24464];
  let state={seed:1,draws:0};
  for(const value of expected){const draw=nextRandom15(state);assert.equal(draw.value,value);state=draw.next;}
  assert.equal(state.draws,expected.length);
});
test('normalized RNG output is exactly raw DOS rand divided by 32768',()=>{
  for(const seed of [0,1,12,0x7fffffff,0xffffffff]){
    const raw=nextRandom15({seed,draws:7});
    const normalized=nextRandom({seed,draws:7});
    assert.deepEqual(raw.next,normalized.next);
    assert.equal(normalized.value,raw.value/32768);
    assert.ok(normalized.value>=0&&normalized.value<1);
  }
});
test('Go Direction exact sequence preserves one army move per round',()=>{
  let g=setOrder(makeRulesLab(),'u1',{kind:'go-direction',direction:{x:1,y:0}});
  for(const x of [10,11,12,13]){
    g=x===10?runMoveToOrders(g):advanceLabRound(g);
    assert.deepEqual(unit(g).position,{x,y:25});
    assert.equal(unit(g).order.kind,'go-direction');
  }
});
test('Patrol reverses at both endpoints and keeps order through turns',()=>{
  let g=setOrder(makeRulesLab(),'u1',{kind:'patrol',from:{x:9,y:25},to:{x:11,y:25},outbound:true});
  for(const x of [10,11,10,9,10]){
    g=x===10&&g.round===1?runMoveToOrders(g):advanceLabRound(g);
    assert.equal(unit(g).position.x,x);
    assert.equal(unit(g).order.kind,'patrol');
  }
});
test('standing orders survive save/restore with exact destination and deterministic continuation',()=>{
  const assigned=setOrder(makeRulesLab(),'u1',{kind:'move-to',destination:{x:17,y:27}});
  const restored=importSave(exportSave(assigned));
  assert.deepEqual(unit(restored).order,unit(assigned).order);
  assert.deepEqual(runMoveToOrders(restored),runMoveToOrders(assigned));
});
test('automated order never consumes RNG or attacks a blocking enemy',()=>{
  let g=makeRulesLab();
  g.units[2].position={x:10,y:25};
  updateAllKnowledge(g);
  const before=g.rng;
  g=setOrder(g,'u1',{kind:'go-direction',direction:{x:1,y:0}});
  g=runMoveToOrders(g);
  assert.deepEqual(g.rng,before);
  assert.deepEqual(unit(g).position,{x:9,y:25});
  assert.ok(g.units.some(u=>u.id==='u3'));
});
