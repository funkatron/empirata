import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
import {makeCampaign} from './campaign-maps.mjs';

// Run after both revisions have been built. Never use hidden-world data to
// direct a player: the full game state is used only for offline measurement.
const [baselinePath,candidatePath]=process.argv.slice(2);
if(!baselinePath||!candidatePath)throw Error('Usage: node scripts/compare-reconnaissance.mjs BASELINE_ENGINE CANDIDATE_ENGINE');
const baseline=await import(pathToFileURL(resolve(baselinePath)).href);
const candidate=await import(pathToFileURL(resolve(candidatePath)).href);
const rounds=Number(process.env.RECON_ROUNDS??60);
if(!Number.isInteger(rounds)||rounds<1||rounds>300)throw Error('Invalid RECON_ROUNDS');
const runs=[];
for(const layout of ['continents','islands','archipelago'])for(const seed of [29,137])for(const swap of [false,true]){
 const job={layout,seed,swap,rounds};
 const initial=makeCampaign(baseline,layout,seed,{swap,cityCount:12,minSpacing:7});
 let a=structuredClone(initial),b=structuredClone(initial);
 const measure=(E,g)=>Object.fromEntries(['blue','red'].map(f=>{
  const view=E.getPlayerView(g,f);
  return [f,{cities:view.ownCities.length,knownTargets:view.cells.filter(c=>c.city&&c.city.owner!==f).length,
   explored:view.cells.filter(c=>c.terrain!==null).length,
   loadedArmies:view.ownUnits.filter(u=>u.kind==='army'&&u.aboard).length,
   destroyers:view.ownUnits.filter(u=>u.kind==='destroyer').length}];
 }));
 const initialMetrics=measure(baseline,initial);
 const firstDiscovery={baseline:{blue:null,red:null},candidate:{blue:null,red:null}};
 let completed=0;
 for(let n=0;n<rounds;n++){
  if(baseline.gameOutcome(a).state==='finished'||candidate.gameOutcome(b).state==='finished')break;
  a=baseline.advanceLabRound(a);b=candidate.advanceLabRound(b);completed++;
  for(const [name,E,g] of [['baseline',baseline,a],['candidate',candidate,b]]){
   const m=measure(E,g);
   for(const f of ['blue','red'])if(firstDiscovery[name][f]===null&&m[f].knownTargets>initialMetrics[f].knownTargets)firstDiscovery[name][f]=completed;
  }
 }
 const base=measure(baseline,a),next=measure(candidate,b);
 runs.push({job,completed,firstDiscovery,baseline:base,candidate:next,
  delta:Object.fromEntries(['blue','red'].map(f=>[f,Object.fromEntries(['cities','knownTargets','explored','loadedArmies','destroyers'].map(k=>[k,next[f][k]-base[f][k]]))]))});
 console.log(`${layout} seed=${seed} swap=${swap}: ${completed} rounds; explored delta blue=${runs.at(-1).delta.blue.explored}, red=${runs.at(-1).delta.red.explored}`);
}
const report={schema:1,baseline:'PR #50 main (bc3b729)',candidate:'PR #51',rounds,runs,
 caveats:['This is a short-horizon diagnostic, not proof of AI strength.','Only private PlayerView informs each AI; omniscient state is used for offline evaluation.','First discovery measures newly known non-friendly cities, not necessarily enemy-held cities.','Units lost and landing events are not yet instrumented.']};
mkdirSync('recon-results',{recursive:true});writeFileSync('recon-results/comparison.json',JSON.stringify(report,null,2)+'\n');
const lines=['# Reconnaissance comparison','','Baseline: PR #50. Candidate: PR #51.','',
 '| Layout | Seed | Swapped | Rounds | Blue explored Δ | Red explored Δ | Blue cities Δ | Red cities Δ |','|---|---:|:---:|---:|---:|---:|---:|---:|',
 ...runs.map(r=>`| ${r.job.layout} | ${r.job.seed} | ${r.job.swap?'yes':'no'} | ${r.completed} | ${r.delta.blue.explored} | ${r.delta.red.explored} | ${r.delta.blue.cities} | ${r.delta.red.cities} |`),
 '',...report.caveats.map(s=>'- '+s)];
writeFileSync('recon-results/summary.md',lines.join('\n')+'\n');
