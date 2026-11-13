// Evaluation-only terrain. No units, scouting memory, production head start,
// guaranteed route or adjusted combat result is supplied to either opponent.
// Default algorithm remains ellipse-v1 so frozen study baselines stay reproducible.
export const layouts=['continents','islands','archipelago'];
export function makeCampaign(engine,layout,seed,{
  swap=false,cityCount,minSpacing,algorithm='ellipse-v1',density='sparse',
}={}){
  const options={algorithm,density};
  if(cityCount!==undefined)options.cityCount=cityCount;
  if(minSpacing!==undefined)options.minSpacing=minSpacing;
  if(cityCount!==undefined&&(!Number.isInteger(cityCount)||cityCount<4||cityCount>100))
    throw new Error('Invalid map parameters');
  if(minSpacing!==undefined&&(!Number.isInteger(minSpacing)||minSpacing<2))
    throw new Error('Invalid map parameters');
  if(!layouts.includes(layout))throw new Error('Unknown campaign layout');
  // Prefer engine makeCampaignMap when available (keeps organic-v1 + ellipse-v1 in one place).
  if(typeof engine.makeCampaignMap==='function'){
    const g=engine.makeCampaignMap(layout,seed,'ai-vs-ai',swap,options);
    return g;
  }
  throw new Error('Engine makeCampaignMap is required');
}
