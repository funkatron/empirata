// Evaluation-only terrain. No units, scouting memory, production head start,
// guaranteed route or adjusted combat result is supplied to either opponent.
export const layouts=['continents','islands','archipelago'];
export function makeCampaign(engine,layout,seed,{swap=false,cityCount=12,minSpacing=7}={}){
  if(!Number.isInteger(cityCount)||cityCount<4||cityCount>100||!Number.isInteger(minSpacing)||minSpacing<2)throw new Error('Invalid map parameters');
  if(!layouts.includes(layout))throw new Error('Unknown campaign layout');
  let state=seed>>>0||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const g=engine.makeAiVsAiLab(),{width,height}=g;
  g.tiles.fill('sea');
  const config={continents:[7,18,13],islands:[16,10,8],archipelago:[32,5,4]}[layout];
  const [count,rx,ry]=config;
  for(let i=0;i<count;i++){
    const cx=5+random()*(width-10),cy=5+random()*(height-10);
    const a=rx*(0.6+random()*0.8),b=ry*(0.6+random()*0.8);
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)
      if(((x-cx)/a)**2+((y-cy)/b)**2<1)g.tiles[y*width+x]='land';
  }
  const candidates=[];
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++)
    if(g.tiles[y*width+x]==='land')candidates.push({x,y});
  // Shuffle before placement; all cities are spaced, with no objective-specific
  // coast edits or land bridges. Inland starts are permitted on continents.
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const distance=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const positions=[];
  for(const p of candidates){
    if(layout!=='continents'&&!engine.isCoastal(g,p))continue;
    if(positions.every(q=>distance(p,q)>=minSpacing))positions.push(p);
    if(positions.length===cityCount)break;
  }
  if(positions.length<4)throw new Error(`Insufficient cities: ${layout}/${seed}`);
  // Distant starting cities, selected before any simulation, avoid immediate
  // adjacent combat. The remaining cities are neutral and undiscovered.
  let pair=[0,1];
  for(let a=0;a<positions.length;a++)for(let b=a+1;b<positions.length;b++)
    if(distance(positions[a],positions[b])>distance(positions[pair[0]],positions[pair[1]]))pair=[a,b];
  g.cities=positions.map((position,i)=>({id:`generated-${i}`,position,
    owner:i===pair[0]?(swap?'red':'blue'):i===pair[1]?(swap?'blue':'red'):null,
    production:null,progress:0,firstCycle:true}));
  g.rng={seed:(seed^0x9e3779b9)>>>0,draws:0};
  g.events=[];g.nextEventId=1;
  for(const faction of ['blue','red','green'])g.knowledge[faction]=engine.emptyKnowledge(g);
  engine.updateAllKnowledge(g);
  return g;
}
