import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function jobsFor(m){
 if(m.schemaVersion!==1||!Number.isInteger(m.roundLimit)||m.roundLimit<1||m.roundLimit>300)throw Error('Invalid manifest');
 for(const k of ['baselineSha','candidateSha'])if(!/^[0-9a-f]{40}$/.test(m[k]))throw Error('Unpinned revision');
 for(const k of ['mapSeeds','combatSeeds'])if(!Array.isArray(m[k])||!m[k].length||new Set(m[k]).size!==m[k].length||m[k].some(n=>!Number.isInteger(n)||n<1||n>0xffffffff))throw Error('Invalid seeds');
 if(JSON.stringify(m.candidateLocations)!=='["A","B"]'||JSON.stringify(m.candidateFactions)!=='["blue","red"]')throw Error('Unbalanced placements');
 if(JSON.stringify(m.layouts)!=='["continents","islands","archipelago"]')throw Error('Invalid layouts');
 const jobs=[];
 for(const layout of m.layouts)for(const mapSeed of m.mapSeeds)for(const combatSeed of m.combatSeeds){
  for(const faction of m.candidateFactions)for(const location of m.candidateLocations)
   jobs.push({kind:'comparison',layout,mapSeed,combatSeed,faction,location});
  for(const location of m.candidateLocations)jobs.push({kind:'control',layout,mapSeed,combatSeed,faction:'blue',location});
 }
 for(const j of jobs)j.id=[j.kind,j.layout,j.mapSeed,j.combatSeed,j.faction,j.location].join('-');
 if(new Set(jobs.map(j=>j.id)).size!==jobs.length||jobs.filter(j=>j.kind==='comparison').length!==m.candidateCampaigns||jobs.filter(j=>j.kind==='control').length!==m.baselineControlCampaigns)throw Error('Manifest count mismatch');
 return jobs;
}
export function initialFor(E,makeCampaign,m,j){
 const g=makeCampaign(E,j.layout,j.mapSeed,{cityCount:m.cityCount,minSpacing:7});
 if(g.cities.length!==m.cityCount||g.units.length)throw Error('Invalid initial roster');
 const starts=g.cities.filter(c=>c.owner==='blue'||c.owner==='red');
 if(starts.length!==2)throw Error('Invalid starting cities');
 const originalBlue=starts.find(c=>c.owner==='blue');
 const blueAtA=j.faction==='blue'?j.location==='A':j.location==='B';
 if(!blueAtA)for(const c of starts)c.owner=c.owner==='blue'?'red':'blue';
 g.rng={seed:j.combatSeed,draws:0};
 for(const f of ['blue','red','green'])g.knowledge[f]=E.emptyKnowledge(g);
 E.updateAllKnowledge(g);
 return {state:g,geometryHash:digest({tiles:g.tiles,cities:g.cities.map(c=>({id:c.id,position:c.position}))}),candidateStart:(j.location==='A'?originalBlue:starts.find(c=>c!==originalBlue)).position};
}
export function advanceMixed(g,E,policies){
 if(E.gameOutcome(g).state==='finished')return g;
 if(g.active!=='blue'||g.scenario!=='ai-vs-ai')throw Error('Unexpected round boundary');
 g=policies.blue.playAiOpponent(g,'blue');
 g=E.endTurn(g);
 if(g.active==='red')g=policies.red.playAiOpponent(g,'red');
 let turns=0;
 while(g.active!=='blue'){if(++turns>3)throw Error('Turn cycle failed');g=E.endTurn(g);}
 return g;
}
