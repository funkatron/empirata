import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {digest,jobsFor,initialFor,advanceMixed,completionFor} from './held-out-core.mjs';
const [baselineDir,candidateDir]=process.argv.slice(2).map(p=>resolve(p));
if(!baselineDir||!candidateDir)throw Error('Pass baseline and candidate checkout directories');
const m=JSON.parse(readFileSync('agents/evaluation/held-out-reconnaissance.json','utf8'));
const sha=dir=>execFileSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(sha(baselineDir)!==m.baselineSha||sha(candidateDir)!==m.candidateSha)throw Error('Checkout revision mismatch');
// Policy mixing is valid only for this bounded planner-only change. Fail closed
// if a later revision changes shared rules, helpers, state schema or turn logic.
const baseSource=readFileSync(resolve(baselineDir,'src/engine/game.ts'),'utf8');
const nextSource=readFileSync(resolve(candidateDir,'src/engine/game.ts'),'utf8');
const mask=s=>s.replace(/export function planAi(?:Naval|Ground)ScoutStep[\s\S]*?(?=\nexport function )/g,'SCOUT_PLANNER\n');
if(mask(baseSource)!==mask(nextSource))throw Error('Candidate changes outside allowed scout planners');
const changed=execFileSync('git',['-C',candidateDir,'diff',m.baselineSha,m.candidateSha,'--name-only','--','src/engine'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(changed.some(p=>p!=='src/engine/game.ts'))throw Error('Shared engine source changed');
const E=await import(pathToFileURL(resolve(baselineDir,'dist/engine/index.js')));
const C=await import(pathToFileURL(resolve(candidateDir,'dist/engine/index.js')));
const {makeCampaign}=await import(pathToFileURL(resolve(baselineDir,'scripts/campaign-maps.mjs')));
const jobs=jobsFor(m).filter(j=>!process.env.MAP_SEED||j.mapSeed===Number(process.env.MAP_SEED)).filter(j=>!process.env.MAP_LAYOUT||j.layout===process.env.MAP_LAYOUT);
if(!jobs.length)throw Error('Empty shard');
const smoke=process.env.EVALUATION_MODE==='smoke';
if(process.env.EVALUATION_MODE&&!['smoke','full'].includes(process.env.EVALUATION_MODE))throw Error('Unknown evaluation mode');
const selectedJobs=smoke?jobs.filter(j=>j.kind==='comparison').slice(0,1):jobs;
const roundLimit=smoke?Math.min(30,m.roundLimit):m.roundLimit;
const out='held-out-results';mkdirSync(out,{recursive:true});
const metadata={schemaVersion:1,baselineSha:m.baselineSha,candidateSha:m.candidateSha,engineSha:m.baselineSha,generatorSha:m.baselineSha,evaluatorSha:sha('.'),manifestHash:digest(m),node:process.version,holdoutStatus:m.holdoutStatus,definitions:{retainedEnemyCities:'Initially enemy-owned cities captured and still held at final observation; early terminal observations separate from round-limit observations.',firstEnemyDiscovery:'First round-boundary private view containing an enemy-owned city.',loadedTransportLosses:'Unavailable: per-action removal instrumentation not implemented.',cargoIdleTurns:'Unavailable: per-action movement instrumentation not implemented.'}};
writeFileSync(out+'/metadata.json',JSON.stringify(metadata,null,2));
const statuses=[];
for(const j of selectedJobs){
 const start=performance.now(),initial=initialFor(E,makeCampaign,m,j);
 let g=initial.state,rounds=0,status='running',error=null;
 const initialHash=digest(g),initialEnemy=new Set(g.cities.filter(c=>c.owner!==null&&c.owner!==j.faction).map(c=>c.id));
 const policies={blue:E,red:E};if(j.kind==='comparison')policies[j.faction]=C;
 const firstEnemyDiscovery={blue:null,red:null};
 const observe=()=>{for(const f of ['blue','red'])if(firstEnemyDiscovery[f]===null&&E.getPlayerView(g,f).cells.some(c=>c.city&&c.city.owner!==null&&c.city.owner!==f))firstEnemyDiscovery[f]=rounds;};
 try{
  E.importSave(E.exportSave(g));C.importSave(C.exportSave(g));observe();
  while(rounds<roundLimit){
   if(E.gameOutcome(g).state==='finished'){status='finished';break;}
   if(performance.now()-start>180000){status='time-limit';break;}
   g=advanceMixed(g,E,policies);rounds++;observe();
  }
  if(status==='running')status=E.gameOutcome(g).state==='finished'?'finished':'round-limit';
 }catch(e){status='error';error=String(e.stack??e);}
 const row={...j,...metadata,initialHash,geometryHash:initial.geometryHash,candidateStart:initial.candidateStart,status,error,completedRounds:rounds,elapsedMs:performance.now()-start,finalHash:digest(g),outcome:E.gameOutcome(g),firstEnemyDiscovery,retainedEnemyCities:g.cities.filter(c=>initialEnemy.has(c.id)&&c.owner===j.faction).length,finalCities:Object.fromEntries(['blue','red'].map(f=>[f,g.cities.filter(c=>c.owner===f).length])),loadedTransportLosses:null,cargoIdleTurns:null};
 statuses.push(status);
 writeFileSync(out+'/'+j.id+'.json',JSON.stringify(row,null,2)+'\n');
 console.log(j.id+': '+status+' '+rounds+' rounds');
}
// Keep every campaign record, but never report a successful evaluation when
// any job failed or stopped short of a terminal/round-limit observation.
const completion={...completionFor(statuses),mode:smoke?'smoke':'full',roundLimit,originalRoundLimit:m.roundLimit};
writeFileSync(out+'/completion.json',JSON.stringify(completion,null,2)+'\n');
console.log('Evaluation completion:',JSON.stringify(completion));
if(!completion.complete)process.exitCode=1;
