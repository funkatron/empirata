import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fork} from 'node:child_process';
import {readStudy} from './read-study.mjs';
import {makeCampaign,layouts} from './campaign-maps.mjs';
const out=process.env.STUDY_OUT??'docs/evaluation/strategy-baseline';
const sha=process.env.STUDY_SHA??'unknown';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sides=['blue','red'];
function scenario(E,job){
 const g=makeCampaign(E,job.layout,job.seed,{swap:job.swap,cityCount:64,minSpacing:3});
 if(job.profile==='near'){
  const region=new Map();let number=0;
  for(let k=0;k<g.tiles.length;k++){if(g.tiles[k]!=='land'||region.has(k))continue;const q=[k];region.set(k,number);
   for(let at=0;at<q.length;at++)for(const d of E.directions){const x=q[at]%g.width+d.x,y=Math.floor(q[at]/g.width)+d.y,n=y*g.width+x;if(x>=0&&x<g.width&&y>=0&&y<g.height&&g.tiles[n]==='land'&&!region.has(n)){region.set(n,number);q.push(n);}}number++;}
  const pairs=[];for(let i=0;i<g.cities.length;i++)for(let j=i+1;j<g.cities.length;j++){const a=g.cities[i],b=g.cities[j],distance=Math.max(Math.abs(a.position.x-b.position.x),Math.abs(a.position.y-b.position.y));if(distance<12||distance>25)continue;const same=region.get(a.position.y*g.width+a.position.x)===region.get(b.position.y*g.width+b.position.x);pairs.push({i,j,score:Math.abs(distance-18)+(same?20:0)+(E.isCoastal(g,a.position)?0:4)+(E.isCoastal(g,b.position)?0:4)});}
  pairs.sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j);if(!pairs.length)throw Error('No near start pair');
  for(const c of g.cities)c.owner=null;g.cities[pairs[0].i].owner=job.swap?'red':'blue';g.cities[pairs[0].j].owner=job.swap?'blue':'red';
 }
 if(g.cities.length!==64)throw Error(`Only ${g.cities.length} cities available`);
 if(job.cities===12){const starts=g.cities.filter(c=>c.owner);g.cities=[...starts,...g.cities.filter(c=>!c.owner).slice(0,10)];}
 for(const f of ['blue','red','green'])g.knowledge[f]=E.emptyKnowledge(g);
 E.updateAllKnowledge(g);return g;
}
export {scenario};
function snapshot(E,g,f){
 const v=E.getPlayerView(g,f),units=v.ownUnits,armies=units.filter(u=>u.kind==='army'),ships=units.filter(u=>u.kind==='transport');
 return {cities:v.ownCities.length,ports:v.ownCities.filter(c=>E.isCoastal(g,c.position)).length,
  units:units.length,armies:armies.length,ashore:armies.filter(u=>!u.aboard).length,
  guards:v.ownCities.filter(c=>armies.some(u=>!u.aboard&&u.position.x===c.position.x&&u.position.y===c.position.y)).length,
  beachhead:armies.filter(u=>u.aiBeachhead&&!u.aboard).length,
  byType:Object.fromEntries(E.UNIT_TYPES.map(t=>[t,units.filter(u=>u.kind===t).length])),
  shipLoads:ships.map(s=>({id:s.id,position:s.position,damage:s.damage,load:units.filter(u=>u.aboard===s.id).length,capacity:E.capacity(s),objective:s.aiObjective??null,pickup:s.aiPickup??null,assembly:s.aiAssembly??null})),
  production:Object.fromEntries(E.UNIT_TYPES.map(t=>[t,v.ownCities.filter(c=>c.production===t).length])),
  knownNeutral:v.cells.filter(c=>c.city?.owner===null).length,knownHostile:v.cells.filter(c=>c.city&&c.city.owner!==null&&c.city.owner!==f).length,
  explored:v.cells.filter(c=>c.terrain!==null).length};
}
if(process.argv[2]==='worker'){
 const job=JSON.parse(process.argv[3]);let g;const start=performance.now();
 const E=await import('../study-engine/engine/index.js');
 const report={schema:1,sourceSha:sha,...job,status:'running',checkpoints:[],turns:[],moves:[],landings:[],captures:[],removed:[],events:[],metrics:Object.fromEntries(sides.map(f=>[f,{produced:{},boarded:0,landed:0,unloadedAtPort:0,missionPauses:0,fuelCrashes:0,productionChanges:0,firstTransport:null,firstFighter:null,firstLanding:null}]))};
 const path=`${out}/runs/${job.id}.json`;
 const save=()=>writeFileSync(path,JSON.stringify(report)+'\n');
 try{
  g=scenario(E,job);report.initialHash=digest(g);report.world={land:g.tiles.filter(t=>t==='land').length,cities:g.cities.map(c=>({id:c.id,position:c.position,owner:c.owner})),terrainHash:digest(g.tiles)};
  const check=()=>report.checkpoints.push({round:g.round,factions:Object.fromEntries(sides.map(f=>[f,snapshot(E,g,f)]))});check();
  globalThis.__empirataStudy=e=>{
   if(e.type==='move')report.moves.push(e);
   else if(e.type==='removed')report.removed.push(e);
   else if(e.type==='event'){
    const m=report.metrics[e.owner];if(!m)return;
    if(e.kind==='production'&&e.message.includes('completed')){const type=/completed (\w+)/.exec(e.message)?.[1]?.toLowerCase();if(type){m.produced[type]=(m.produced[type]??0)+1;if(type==='transport')m.firstTransport??=e.round;if(type==='fighter')m.firstFighter??=e.round;}}
    if(/loaded aboard|boarded /.test(e.message))m.boarded++;
    if(e.message.includes('landed from')){m.landed++;m.firstLanding??=e.round;report.landings.push({...e,ship:/landed from (u\d+)/.exec(e.message)?.[1]??null,army:/^(u\d+)/.exec(e.message)?.[1]??null});}
    if(e.message.includes('unloaded in friendly port'))m.unloadedAtPort++;
    if(e.message.includes('paused stalled objective'))m.missionPauses++;
    if(e.kind==='fuel'&&/crashed|ran out/.test(e.message))m.fuelCrashes++;
    if(e.message.includes('Production set'))m.productionChanges++;
    if(e.message.includes(' captured.'))report.captures.push({...e,city:e.message.split(' ')[0]});
    if(e.kind==='combat'||e.kind==='fuel'||e.message.includes('paused stalled objective'))report.events.push(e);
   }
  };
  const times=[];
  for(let r=0;r<job.rounds;r++){
   if(E.gameOutcome(g).state==='finished'){report.status='finished';break;}
   if(performance.now()-start>job.budgetMs){report.status='time-limit';break;}
   const t=performance.now();g=E.advanceLabRound(g);const ms=performance.now()-t;times.push(ms);
   report.turns.push([g.round,ms,...sides.flatMap(f=>{const u=g.units.filter(x=>x.owner===f);const s=u.filter(x=>x.kind==='transport');return [g.cities.filter(c=>c.owner===f).length,u.length,u.filter(x=>x.kind==='army'&&!x.aboard).length,s.length,u.filter(x=>x.kind==='army'&&x.aboard).length,s.filter(x=>u.some(a=>a.aboard===x.id)).length];})]);
   if([26,51,101,151,201,251,301].includes(g.round)){check();report.completedRounds=r+1;save();}
  }
  if(report.status==='running')report.status='round-limit';
  report.completedRounds=times.length;report.finalRound=g.round;report.elapsedMs=performance.now()-start;
  report.timing={meanMs:times.reduce((a,b)=>a+b,0)/Math.max(1,times.length),p95Ms:[...times].sort((a,b)=>a-b)[Math.floor((times.length-1)*.95)]??0,maxMs:Math.max(0,...times)};
  report.outcome=E.gameOutcome(g);check();
  E.importSave(E.exportSave(g));report.saveValid=true;report.finalHash=digest(g);report.finalRng=g.rng;
 }catch(error){report.status='error';report.error=String(error.stack??error);}
 save();console.log(`${job.id}: ${report.status}, ${report.completedRounds??0} rounds`);process.exit(report.status==='error'?1:0);
}else if(process.argv[2]==='run'){
 mkdirSync(`${out}/runs`,{recursive:true});const jobs=[];
 for(const layout of layouts)for(const seed of [17,83,211])for(const swap of [false,true])for(const cities of [12,64]){
  const rounds=seed===17&&cities===64?300:200;
  jobs.push({id:`${layout}-${seed}-${swap?'swap':'normal'}-${cities}`,layout,seed,swap,cities,rounds,budgetMs:180000});
 }
 writeFileSync(`${out}/manifest.json`,JSON.stringify({schema:1,sourceSha:sha,node:process.version,concurrency:4,jobs,turnColumns:['round','elapsedMs','blueCities','blueUnits','blueArmiesAshore','blueTransports','blueEmbarkedArmies','blueLoadedShips','redCities','redUnits','redArmiesAshore','redTransports','redEmbarkedArmies','redLoadedShips'],limits:['200/300-round horizon; 180s per worker','Round-boundary snapshots can miss transient states; legal transport-move and event probes capture short crossings','Timing includes telemetry overhead and concurrent CPU contention','Generated maps do not implement original DOS map validation','Two AI factions, no human adversary; no strategy change comparison']},null,2));
 let index=0,failed=0;
 await Promise.all(Array.from({length:4},async()=>{while(index<jobs.length){const job=jobs[index++];if(process.env.STUDY_RESUME==='1'){try{const old=readStudy(`${out}/runs/${job.id}.json`);if(old.status!=='running'&&old.status!=='error')continue;}catch{}}
  await new Promise(done=>{const child=fork(new URL(import.meta.url),['worker',JSON.stringify(job)],{env:{...process.env,STUDY_SHA:sha,STUDY_OUT:out},stdio:'inherit'});child.on('exit',code=>{if(code)failed++;done();});});}}));
 console.log(`Study complete; failed jobs: ${failed}`);if(failed)process.exitCode=1;
}
