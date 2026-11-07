import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {roundOutcomes} from './campaign-outcomes.mjs';
import * as engine from '../dist/engine/index.js';

const path=process.argv[2];
if(!path)throw Error('Usage: node scripts/replay-uploaded-save.mjs SAVE.json');
const bytes=readFileSync(path);
const initial=engine.importSave(bytes.toString('utf8'));
if(initial.scenario!=='ai-vs-ai')throw Error('Expected AI-vs-AI save');
const startRound=initial.round, rounds=25;
const metrics=g=>Object.fromEntries(['blue','red'].map(f=>{
 const v=engine.getPlayerView(g,f);
 return [f,{cities:v.ownCities.length,explored:v.cells.filter(c=>c.terrain!==null).length,
 knownCities:v.cells.filter(c=>c.city).length,
 transports:v.ownUnits.filter(u=>u.kind==='transport').length,
 embarked:v.ownUnits.filter(u=>u.aboard).length}];
}));
let g=initial;
const before=metrics(g);
const outcomes={blue:{},red:{}};
const trace=[];
for(let i=0;i<rounds;i++){
 if(engine.gameOutcome(g).state==='finished')break;
 const previous=structuredClone({units:g.units,cities:g.cities});
 const old=g;
 g=engine.advanceLabRound(g);
 for(const f of ['blue','red'])for(const [k,n] of Object.entries(roundOutcomes(previous,g,f)))
  outcomes[f][k]=(outcomes[f][k]??0)+n;
 const now=metrics(g);
 trace.push({round:g.round,blue:now.blue,red:now.red,
  movedTransports:Object.fromEntries(['blue','red'].map(f=>[f,g.units.filter(u=>u.owner===f&&u.kind==='transport'&&old.units.some(v=>v.id===u.id&&(v.position.x!==u.position.x||v.position.y!==u.position.y))).length]))});
}
const after=metrics(g);
engine.importSave(engine.exportSave(g));
const result={schema:1,sourceSha256:createHash('sha256').update(bytes).digest('hex'),startRound,
 completed:trace.length,endRound:g.round,before,after,outcomes,trace,
 caveats:['Single saved state, not a matched faction/map campaign.','This measures the current engine only; causal improvement requires replay against a pinned baseline.','Known cities are visible to each faction, not omniscient hidden cities.']};
mkdirSync('replay-results',{recursive:true});
writeFileSync('replay-results/report.json',JSON.stringify(result,null,2)+'\n');
writeFileSync('replay-results/summary.md','# 25-round uploaded-save replay\n\n'+
 'Starting round: '+startRound+'; completed: '+trace.length+'; ending round: '+g.round+'.\n\n'+
 '| Faction | Cities before → after | Explored before → after | Known cities before → after | Transports before → after |\n|---|---|---|---|---|\n'+
 ['blue','red'].map(f=>'| '+f+' | '+before[f].cities+' → '+after[f].cities+' | '+before[f].explored+' → '+after[f].explored+' | '+before[f].knownCities+' → '+after[f].knownCities+' | '+before[f].transports+' → '+after[f].transports+' |').join('\n')+
 '\n\nOutcomes: `'+JSON.stringify(outcomes)+'`\n\n'+result.caveats.map(c=>'- '+c).join('\n')+'\n');
console.log(JSON.stringify({startRound,endRound:g.round,before,after,outcomes},null,2));
