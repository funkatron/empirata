// Evaluation fixtures only: no claim of historical DOS map generation.
import {makeAiVsAiLab,emptyKnowledge,updateAllKnowledge,directions} from '../dist/engine/index.js';

export const mapFamilies=['continents','archipelago','broken-coast'];
export function makeCampaignMap(family,seed){
  if(!mapFamilies.includes(family))throw new Error(`Unknown map family: ${family}`);
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
  const g=makeAiVsAiLab(),w=g.width,h=g.height;
  g.tiles.fill('sea');g.events=[];g.nextEventId=1;g.cities=[];
  g.rng={seed:seed>>>0,draws:0};
  const ellipses=[];
  const count=family==='continents'?3:family==='archipelago'?24:12;
  for(let i=0;i<count;i++){
    const rx=family==='continents'?13+random()*10:family==='archipelago'?3+random()*4:6+random()*6;
    const ry=family==='continents'?12+random()*9:family==='archipelago'?3+random()*4:4+random()*7;
    ellipses.push({x:10+random()*80,y:8+random()*44,rx,ry});
  }
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)
    if(ellipses.some(e=>((x-e.x)/e.rx)**2+((y-e.y)/e.ry)**2<1))g.tiles[y*w+x]='land';
  const land=[],coast=[];
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++)if(g.tiles[y*w+x]==='land'){
    const p={x,y};land.push(p);
    if(directions.some(d=>g.tiles[(y+d.y)*w+x+d.x]==='sea'))coast.push(p);
  }
  const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const first=coast[Math.floor(random()*coast.length)];
  const farthest=(points,chosen)=>points.reduce((best,p)=>{
    const score=Math.min(...chosen.map(c=>distance(c,p)));
    return !best||score>best.score?{p,score}:best;
  },null).p;
  const homes=[first,farthest(coast,[first])],positions=[...homes];
  for(let i=0;i<8;i++)positions.push(farthest(land,positions));
  g.cities=positions.map((position,i)=>({id:`campaign-city-${i}`,position,
    owner:i===0?'blue':i===1?'red':null,production:null,progress:0,firstCycle:true}));
  for(const faction of ['blue','red','green'])g.knowledge[faction]=emptyKnowledge(g);
  updateAllKnowledge(g);
  return g;
}
