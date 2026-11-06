import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as baseline from '../dist/engine/index.js';
import * as measured from '../study-engine/engine/index.js';
import {scenario} from './campaign-study.mjs';
const cases=[];
for(const layout of ['continents','islands','archipelago'])for(const swap of [false,true])cases.push({id:`${layout}-${swap}`,rounds:12,make:()=>scenario(baseline,{layout,swap,seed:17,cities:64})});
cases.push({id:'invasion-movement-capture',rounds:15,make:()=>baseline.makeAiInvasionLab()},{id:'close-combat-skirmish',rounds:12,make:()=>baseline.makeAiVsAiSkirmishLab()});
const report=[];
for(const sample of cases){
 let a=sample.make(),b=structuredClone(a);const counts={};
 globalThis.__empirataStudy=e=>{counts[e.type]=(counts[e.type]??0)+1;};
 for(let n=0;n<sample.rounds;n++){a=baseline.advanceLabRound(a);b=measured.advanceLabRound(b);}
 assert.deepEqual(a,b);report.push({id:sample.id,rounds:sample.rounds,equal:true,probes:counts});
}
assert.ok(report.some(r=>r.probes.move>0));assert.ok(report.some(r=>r.probes.removed>0));
writeFileSync(`${process.env.STUDY_OUT??'docs/evaluation/strategy-baseline'}/probe-validation.json`,JSON.stringify(report,null,2)+'\n');
console.log(report);
