import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const held=JSON.parse(readFileSync('agents/evaluation/held-out-reconnaissance.json','utf8'));
const baseline=JSON.parse(readFileSync('docs/evaluation/strategy-baseline/manifest.json','utf8'));
const pressurePath='docs/evaluation/strategy-baseline/pressure-manifest.json';
const pressure=pressurePath?(()=>{try{return JSON.parse(readFileSync(pressurePath,'utf8'));}catch{return null;}})():null;
const jobs=[...baseline.jobs,...(pressure?.jobs??[])];
const usedSeeds=new Set(jobs.map(j=>j.seed));
const usedLayouts=new Set(jobs.map(j=>j.layout));
const overlaps=[];
for(const mapSeed of held.mapSeeds){
  if(usedSeeds.has(mapSeed))overlaps.push({mapSeed,source:'strategy-baseline manifests'});
}
const evalDir='docs/evaluation';
const otherRefs=[];
for(const name of readdirSync(evalDir)){
  if(!name.endsWith('.json'))continue;
  const text=readFileSync(resolve(evalDir,name),'utf8');
  for(const mapSeed of held.mapSeeds){
    if(text.includes(String(mapSeed)))otherRefs.push({file:name,mapSeed});
  }
}
const audit={
  schemaVersion:1,
  heldMapSeeds:held.mapSeeds,
  heldLayouts:held.layouts,
  baselineSeeds:[...usedSeeds].sort((a,b)=>a-b),
  baselineLayouts:[...usedLayouts].sort(),
  overlapWithBaselineManifest:overlaps,
  otherEvaluationJsonReferences:otherRefs.filter((r,i,a)=>a.findIndex(x=>x.file===r.file&&x.mapSeed===r.mapSeed)===i),
  auditScope:'Only the recorded strategy-baseline and pressure-manifest jobs are checked for exact numeric seed overlap. Other top-level evaluation JSON files are scanned for textual references; this is not a repository-history or private-fixture audit.',
  checkedSources:['docs/evaluation/strategy-baseline/manifest.json',...(pressure?['docs/evaluation/strategy-baseline/pressure-manifest.json']:[])],
  cleared:overlaps.length===0,
  recommendation:overlaps.length===0
    ? 'Map seeds 104729 and 130363 are not used in the 42-campaign baseline manifest; treat as screening holdout only; absence from these manifests does not prove the maps were never used.'
    : 'Replace overlapping seeds before merging held-out results.',
};
writeFileSync('agents/evaluation/held-out-manifest-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(audit.cleared?'Held-out manifest audit: cleared':'Held-out manifest audit: OVERLAP',audit.overlapWithBaselineManifest);
if(!audit.cleared)process.exitCode=1;
