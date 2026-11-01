// Supplement the distant-start baseline with nearby rivals. Same engine and probes.
import {fork} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const out=process.env.STUDY_OUT??'docs/evaluation/strategy-baseline';
const jobs=[];
for(const layout of ['continents','islands','archipelago'])for(const swap of [false,true])jobs.push({id:`${layout}-83-${swap?'swap':'normal'}-64-near`,layout,seed:83,swap,cities:64,profile:'near',rounds:150,budgetMs:180000});
writeFileSync(`${out}/pressure-manifest.json`,JSON.stringify({sourceSha:process.env.STUDY_SHA,jobs,concurrency:4,limits:['12–25-square start distance, favors coastal cities on different land components when available','Supplementary cohort; do not pool its start profile with distant starts']},null,2));
let at=0;
await Promise.all(Array.from({length:4},async()=>{while(at<jobs.length){const job=jobs[at++];await new Promise(done=>{const child=fork(new URL('./campaign-study.mjs',import.meta.url),['worker',JSON.stringify(job)],{env:process.env,stdio:'inherit'});child.on('exit',done);});}}));
