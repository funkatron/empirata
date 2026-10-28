import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {makeCampaign,layouts} from './campaign-maps.mjs';

const engine=await import(pathToFileURL(resolve(process.env.EMPIRATA_ENGINE??'dist/engine/index.js')));
const rounds=Number(process.env.ROUNDS??200);
const seeds=(process.env.SEEDS??'17,83').split(',').map(Number);
const selected=(process.env.LAYOUTS??layouts.join(',')).split(',');
const swap=process.env.SWAP==='1';
if(!Number.isInteger(rounds)||rounds<1||seeds.some(s=>!Number.isInteger(s)||s<1))throw new Error('Invalid rounds/seeds');
const reports=[];
for(const layout of selected)for(const seed of seeds){
  let g=makeCampaign(engine,layout,seed,{swap});
  const stats=Object.fromEntries(['blue','red'].map(f=>[f,{produced:0,boarded:0,landed:0,missionPauses:0,lastCityChange:1}]));
  for(let r=0;r<rounds;r++){
    const eventId=g.nextEventId,owners=g.cities.map(c=>c.owner);
    g=engine.advanceLabRound(g);
    for(const e of g.events.filter(e=>e.id>=eventId)){
      const s=stats[e.recipient];if(!s)continue;
      if(e.kind==='production'&&e.message.includes('completed'))s.produced++;
      if(/loaded aboard|boarded /.test(e.message))s.boarded++;
      if(e.message.includes('landed from'))s.landed++;
      if(e.message.includes('paused stalled objective'))s.missionPauses++;
    }
    for(let i=0;i<g.cities.length;i++)if(owners[i]!==g.cities[i].owner)
      for(const f of [owners[i],g.cities[i].owner])if(stats[f])stats[f].lastCityChange=g.round;
  }
  // End-state structural validation also verifies that every campaign can be
  // exported and reopened in the game. Never import or repair old saves here.
  engine.importSave(engine.exportSave(g));
  const factions=Object.fromEntries(['blue','red'].map(f=>{
    const v=engine.getPlayerView(g,f),s=stats[f];
    return [f,{...s,cities:v.ownCities.length,armies:v.ownUnits.filter(u=>u.kind==='army').length,
      transports:v.ownUnits.filter(u=>u.kind==='transport').length,
      destroyers:v.ownUnits.filter(u=>u.kind==='destroyer').length,
      explored:v.cells.filter(c=>c.terrain!==null).length,knownCities:v.cells.filter(c=>c.city).length,
      roundsWithoutCityChange:g.round-s.lastCityChange}];
  }));
  const report={layout,seed,swap,rounds,cities:g.cities.length,land:g.tiles.filter(t=>t==='land').length,factions};
  reports.push(report);console.error(`${layout}/${seed}: ${Object.entries(factions).map(([f,s])=>`${f} ${s.cities} cities, ${s.landed} landings`).join('; ')}`);
}
console.log(JSON.stringify(reports,null,2));
