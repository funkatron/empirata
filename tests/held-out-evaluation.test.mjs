import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as E from '../dist/engine/index.js';
import {makeCampaign} from '../scripts/campaign-maps.mjs';
import {jobsFor,initialFor,advanceMixed,digest} from '../scripts/held-out-core.mjs';
const m=JSON.parse(readFileSync('agents/evaluation/held-out-reconnaissance.json','utf8'));
test('held-out map seeds are disjoint from 42-campaign baseline manifest',()=>{
 execFileSync('node',['scripts/audit-held-out-manifest.mjs'],{stdio:'inherit'});
 const audit=JSON.parse(readFileSync('agents/evaluation/held-out-manifest-audit.json','utf8'));
 assert.equal(audit.cleared,true);
 assert.ok(existsSync('agents/evaluation/held-out-manifest-audit.json'));
});
test('balanced unique comparisons and controls',()=>{
 const jobs=jobsFor(m);assert.equal(jobs.length,72);
 for(const layout of m.layouts)for(const seed of m.mapSeeds){
  const shard=jobs.filter(j=>j.layout===layout&&j.mapSeed===seed);
  assert.equal(shard.filter(j=>j.kind==='comparison').length,8);
  assert.equal(shard.filter(j=>j.kind==='control').length,4);
 }
 assert.throws(()=>jobsFor({...m,combatSeeds:[1,1]}));
 assert.throws(()=>jobsFor({...m,candidateSha:'main'}));
 assert.throws(()=>jobsFor({...m,candidateCampaigns:47}));
});
test('paired starts preserve geometry and independent combat seed',()=>{
 for(const layout of m.layouts)for(const mapSeed of m.mapSeeds){
  const jobs=jobsFor(m).filter(j=>j.layout===layout&&j.mapSeed===mapSeed&&j.combatSeed===m.combatSeeds[0]&&j.kind==='comparison');
  const states=jobs.map(j=>initialFor(E,makeCampaign,m,j));
  assert.equal(new Set(states.map(x=>x.geometryHash)).size,1);
  for(let i=0;i<jobs.length;i++){
   const {state,candidateStart}=states[i];
   assert.deepEqual(state.rng,{seed:m.combatSeeds[0],draws:0});
   assert.deepEqual(state.cities.find(c=>c.owner===jobs[i].faction).position,candidateStart);
   assert.equal(digest(state),digest(initialFor(E,makeCampaign,m,jobs[i]).state));
  }
 }
});
test('mixed runner dispatches both policies and matches baseline round',()=>{
 const g=E.makeAiVsAiLab(),calls=[];
 const wrap=f=>({playAiOpponent:(state,side)=>{calls.push(side);assert.equal(side,f);return E.playAiOpponent(state,side);}});
 const mixed=advanceMixed(structuredClone(g),E,{blue:wrap('blue'),red:wrap('red')});
 assert.deepEqual(calls,['blue','red']);
 assert.deepEqual(mixed,E.advanceLabRound(structuredClone(g)));
});
