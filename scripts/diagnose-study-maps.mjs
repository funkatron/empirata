import {readStudy} from './read-study.mjs';
// Omniscient map diagnostics for evaluation only; never supplied to either AI.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine/index.js';
import {scenario} from './campaign-study.mjs';
const root=process.env.STUDY_OUT??'docs/evaluation/strategy-baseline';
const manifests=['manifest.json','pressure-manifest.json'].filter(f=>existsSync(`${root}/${f}`)).map(f=>JSON.parse(readFileSync(`${root}/${f}`)));
const result=[];
for(const job of manifests.flatMap(m=>m.jobs)){
 const g=scenario(E,job),regions=new Map();let count=0;
 for(let k=0;k<g.tiles.length;k++){
  if(g.tiles[k]!=='land'||regions.has(k))continue;
  const queue=[k];regions.set(k,count);
  for(let at=0;at<queue.length;at++)for(const d of E.directions){const x=queue[at]%g.width+d.x,y=Math.floor(queue[at]/g.width)+d.y,n=y*g.width+x;if(x>=0&&x<g.width&&y>=0&&y<g.height&&g.tiles[n]==='land'&&!regions.has(n)){regions.set(n,count);queue.push(n);}}
  count++;
 }
 const key=p=>p.y*g.width+p.x;
 const factions=Object.fromEntries(['blue','red'].map(f=>{
  const start=g.cities.find(c=>c.owner===f),component=regions.get(key(start.position));
  const local=g.cities.filter(c=>regions.get(key(c.position))===component);
  const ports=local.filter(c=>E.isCoastal(g,c.position));
  return [f,{startingCity:start.id,component,startingPort:E.isCoastal(g,start.position),citiesOnStartLandmass:local.length,portCitiesOnStartLandmass:ports.length,portIds:ports.map(c=>c.id),enemyStartsOnLandmass:local.some(c=>c.owner&&c.owner!==f),portAccessPhysicallyPossible:ports.length>0}];
 }));
 result.push({id:job.id,profile:job.profile??'distant',landComponents:count,terrainHash:createHash('sha256').update(JSON.stringify(g.tiles)).digest('hex'),factions});
}
writeFileSync(`${root}/map-diagnostics.json`,JSON.stringify(result,null,2)+'\n');
console.log('Diagnosed',result.length,'maps; start sides without any port opportunity:',result.flatMap(r=>Object.values(r.factions)).filter(f=>!f.portAccessPhysicallyPossible).length);
