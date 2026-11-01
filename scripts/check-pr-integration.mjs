import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as baseline from '../dist/engine/index.js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
if(!process.env.HARBOR_ENGINE||!process.env.NEUTRAL_ENGINE)throw Error('Set HARBOR_ENGINE and NEUTRAL_ENGINE to separately built engine index.js paths');
const harbor=await import(pathToFileURL(resolve(process.env.HARBOR_ENGINE)));
const neutral=await import(pathToFileURL(resolve(process.env.NEUTRAL_ENGINE)));
import {scenario} from './campaign-study.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const decisionState=g=>{const copy=structuredClone(g);for(const e of copy.events)delete e.message;return copy;};
const report={baselineSha:'579784a19403f673298199b326163931d7cc4688',harborSha:process.env.HARBOR_SHA,neutralSha:process.env.NEUTRAL_SHA,checks:[],limits:['Early 60-round samples and fixtures do not establish long-run equivalence or a change in strength','Event message text is excluded from decision-state comparison because direct Blue planning corrects embedded faction names','No empirical advantage is attributed to harbor geometry here']};
for(const layout of ['continents','islands','archipelago'])for(const swap of [false,true]){
 const job={layout,seed:83,cities:64,swap};
 let a=scenario(baseline,job),b=scenario(neutral,job),h=scenario(harbor,job);
 assert.deepEqual(a,h,'Generated study terrain/cities must erase the clean-fixture harbor change');
 for(let r=0;r<60;r++){a=baseline.advanceLabRound(a);b=neutral.advanceLabRound(b);}
 const equal=digest(decisionState(a))===digest(decisionState(b));
 report.checks.push({layout,swap,rounds:60,generatedHarborInvariant:true,decisionStateEqual:equal,baselineHash:digest(decisionState(a)),neutralHash:digest(decisionState(b)),baselineCities:a.cities.filter(c=>c.owner).length,neutralCities:b.cities.filter(c=>c.owner).length});
}
report.cleanHarbors={baseline:baseline.makeAiVsAiLab().cities.filter(c=>c.owner).map(c=>({id:c.id,position:c.position})),proposed:harbor.makeAiVsAiLab().cities.filter(c=>c.owner).map(c=>({id:c.id,position:c.position}))};
writeFileSync('docs/evaluation/strategy-baseline/pr-integration.json',JSON.stringify(report,null,2)+'\n');console.log(report);
