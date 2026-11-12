#!/usr/bin/env node
/** Diagnostic round timings for AI-heavy scenarios. Not a CI gate. */
import {performance} from 'node:perf_hooks';
import {
  advanceLabRound,gameOutcome,makeAiVsAiLab,makeAiVsAiSkirmishLab,makeCampaignMap,
} from '../dist/engine/index.js';

function stats(xs){
  if(!xs.length)return null;
  const s=[...xs].sort((a,b)=>a-b);
  const at=p=>s[Math.min(s.length-1,Math.floor((s.length-1)*p))];
  const mean=s.reduce((a,b)=>a+b,0)/s.length;
  return {n:s.length,mean:+mean.toFixed(2),p50:+at(.5).toFixed(2),p95:+at(.95).toFixed(2),max:+s.at(-1).toFixed(2)};
}

function run(label,make,rounds){
  let g=make();
  const times=[];
  const samples=[];
  const wall0=performance.now();
  for(let i=0;i<rounds;i++){
    const t0=performance.now();
    g=advanceLabRound(g);
    const ms=performance.now()-t0;
    times.push(ms);
    if(i===0||i===9||i===24||i===49||i===rounds-1){
      samples.push({i,ms:+ms.toFixed(2),round:g.round,units:g.units.length,
        ownedCities:g.cities.filter(c=>c.owner).length});
    }
    if(gameOutcome(g).state==='finished')break;
  }
  return {label,wallMs:+(performance.now()-wall0).toFixed(1),final:{round:g.round,units:g.units.length},
    round:stats(times),samples};
}

const jobs=[
  ['ai-vs-ai-lab-100',()=>makeAiVsAiLab(),100],
  ['ai-vs-ai-skirmish-100',()=>makeAiVsAiSkirmishLab(),100],
  ['campaign-continents-cvc-60',()=>makeCampaignMap('continents',11,'ai-vs-ai'),60],
];
for(const [label,make,rounds] of jobs)console.log(JSON.stringify(run(label,make,rounds),null,2));
