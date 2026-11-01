import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readStudy} from './read-study.mjs';
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=process.env.STUDY_OUT??'docs/evaluation/strategy-baseline';
const main=JSON.parse(readFileSync(`${root}/manifest.json`));
const pressure=JSON.parse(readFileSync(`${root}/pressure-manifest.json`));
const expected=[...main.jobs,...pressure.jobs];const results=[];
for(const job of expected){
 const r=readStudy(`${root}/runs/${job.id}.json`);
 assert.ok(['round-limit','time-limit','finished'].includes(r.status),job.id);
 assert.equal(r.sourceSha,main.sourceSha);assert.equal(r.saveValid,true);
 assert.equal(r.completedRounds,r.turns.length);
 for(const move of r.moves){assert.ok(move.cargo>=0&&move.cargo<=move.capacity);assert.ok(['blue','red'].includes(move.owner));}assert.equal(r.finalRound,r.completedRounds+1);
 assert.ok(/^[a-f0-9]{64}$/.test(r.initialHash)&&/^[a-f0-9]{64}$/.test(r.finalHash));
 for(const f of ['blue','red'])for(const kind of ['army','fighter','transport','destroyer','carrier','submarine','cruiser','battleship']){
  const produced=r.metrics[f].produced[kind]??0,live=r.checkpoints.at(-1).factions[f].byType[kind];
  const removed=r.removed.filter(e=>e.owner===f&&e.kind===kind).length;
  assert.equal(produced,live+removed+(kind==='fighter'?r.metrics[f].fuelCrashes:0),`${job.id}/${f}/${kind}`);
 }
 results.push({id:job.id,status:r.status,rounds:r.completedRounds,saveValid:true,unitAccounting:true});
}
assert.equal(new Set(readdirSync(`${root}/runs`).filter(p=>/\.json(?:\.gz)?$/.test(p)).map(p=>p.replace(/\.gz$/,''))).size,expected.length);
if(existsSync(`${root}/dataset-files.json`)){
 for(const file of JSON.parse(readFileSync(`${root}/dataset-files.json`))){const bytes=readFileSync(`${root}/${file.path}`),raw=gunzipSync(bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.gzipSha256);assert.equal(createHash('sha256').update(raw).digest('hex'),file.rawSha256);}
}
writeFileSync(`${root}/validation.json`,JSON.stringify({runs:results.length,sourceSha:main.sourceSha,checks:results},null,2)+'\n');
console.log(`Validated ${results.length} campaigns: completion status, save, counters and all unit-accounting identities.`);
