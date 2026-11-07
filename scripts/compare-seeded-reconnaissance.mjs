import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {makeReconnaissanceFixture} from './reconnaissance-fixture.mjs';

const [baselinePath,candidatePath]=process.argv.slice(2);
if(!baselinePath||!candidatePath)throw Error('Usage: node scripts/compare-seeded-reconnaissance.mjs BASELINE_ENGINE CANDIDATE_ENGINE');
const baseline=await import(pathToFileURL(resolve(baselinePath)).href);
const candidate=await import(pathToFileURL(resolve(candidatePath)).href);
const checkpoints=[20,50,100];
const rows=[];
const metrics=(E,g,f,ids)=>{
 const v=E.getPlayerView(g,f);
 return {explored:v.cells.filter(c=>c.terrain!==null).length,
  knownTargets:v.cells.filter(c=>c.city&&c.city.owner!==f).length,
  cities:v.ownCities.length,
  scouts:Object.fromEntries(ids.map(id=>[id,v.ownUnits.find(u=>u.id===id)?.position??null])),
  scoutSurvivors:ids.filter(id=>v.ownUnits.some(u=>u.id===id)).length,
  embarkedArmies:v.ownUnits.filter(u=>u.kind==='army'&&u.aboard).length};
};
for(const layout of ['continents','islands','archipelago'])
 for(const seed of [29,137])for(const swap of [false,true]){
  const fixture=makeReconnaissanceFixture(baseline,{layout,seed,swap});
  const {faction,digest,scoutIds}=fixture;
  let a=structuredClone(fixture.state),b=structuredClone(fixture.state);
  // Fail early if candidate cannot read the same fixture.
  candidate.importSave(candidate.exportSave(b));
  const firstSteps={baseline:null,candidate:null};
  const initial=metrics(baseline,a,faction,scoutIds);
  let firstDifference=null,completed=0;
  for(let round=1;round<=100;round++){
   if(baseline.gameOutcome(a).state==='finished'||candidate.gameOutcome(b).state==='finished')break;
   a=baseline.advanceLabRound(a);
   b=candidate.advanceLabRound(b);
   completed=round;
   if(firstDifference===null&&JSON.stringify(a)!==JSON.stringify(b))firstDifference=round;
   if(round===1){
    firstSteps.baseline=metrics(baseline,a,faction,scoutIds).scouts;
    firstSteps.candidate=metrics(candidate,b,faction,scoutIds).scouts;
   }
   if(checkpoints.includes(round)){
    const base=metrics(baseline,a,faction,scoutIds),next=metrics(candidate,b,faction,scoutIds);
    rows.push({layout,seed,swap,faction,digest,checkpoint:round,completed,firstDifference,
     firstSteps,initial,baseline:base,candidate:next,
     delta:{explored:next.explored-base.explored,knownTargets:next.knownTargets-base.knownTargets,
      cities:next.cities-base.cities,scoutSurvivors:next.scoutSurvivors-base.scoutSurvivors}});
   }
  }
  if(!rows.some(r=>r.layout===layout&&r.seed===seed&&r.swap===swap))
   throw Error('Seeded fixture terminated before first checkpoint');
  console.log(`${layout}/${seed} swapped=${swap}: ${completed} rounds; first difference ${firstDifference??'none'}`);
 }
const report={schema:1,kind:'seeded-reconnaissance',baseline:'PR #50',candidate:'PR #51',
 caveats:['First-step positions are proxies for scout decisions, not internal planner destination telemetry.',
  'Stale sightings are synthetic evaluation memory, not evidence of a historically observed unit.',
  'Changes in exploration and captures do not by themselves establish stronger long-term play.'],rows};
mkdirSync('recon-results',{recursive:true});
writeFileSync('recon-results/seeded-comparison.json',JSON.stringify(report,null,2)+'\n');
const lines=['# Seeded reconnaissance comparison','',
 '| Layout | Seed | Swap | Checkpoint | First state difference | First scout steps differ | Explored Δ | Known targets Δ | Cities Δ |',
 '|---|---:|:---:|---:|---:|:---:|---:|---:|---:|',
 ...rows.map(r=>`| ${r.layout} | ${r.seed} | ${r.swap?'yes':'no'} | ${r.checkpoint} | ${r.firstDifference??'none'} | ${JSON.stringify(r.firstSteps.baseline)!==JSON.stringify(r.firstSteps.candidate)?'yes':'no'} | ${r.delta.explored} | ${r.delta.knownTargets} | ${r.delta.cities} |`),
 '',...report.caveats.map(c=>'- '+c)];
writeFileSync('recon-results/seeded-summary.md',lines.join('\n')+'\n');
