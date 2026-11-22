import type {AiPolicy,MapRecipe} from '../engine/index.js';
import {DEFAULT_AI_POLICY,isCampaignLayout,isCityDensity,isMapAlgorithm,mapRecipeFromCampaign,parseCampaignSeed} from '../engine/index.js';

type SeedSource='custom'|'random';
const el=(id:string)=>document.getElementById(id)!;

export function seedSource():SeedSource{
  return (el('campaignSeedSource') as HTMLSelectElement).value==='custom'?'custom':'random';
}

export function syncCampaignSeedControls():void{
  const seedInput=el('campaignSeed') as HTMLInputElement;
  seedInput.readOnly=seedSource()==='random';
}

export function syncCampaignClassicGrade():void{
  const classic=(el('campaignAiPolicy') as HTMLSelectElement).value==='classic-dos';
  (el('campaignClassicGrade') as HTMLSelectElement).disabled=!classic;
}

export function readCampaignAiPolicy():AiPolicy{
  const kind=(el('campaignAiPolicy') as HTMLSelectElement).value;
  if(kind==='classic-dos'){
    const grade=Number((el('campaignClassicGrade') as HTMLSelectElement).value);
    return {kind:'classic-dos',grade:grade===2?2:1};
  }
  return {kind:'modern-experimental'};
}

export function applyAiPolicyToMenu(policy:AiPolicy|undefined):void{
  const resolved=policy??DEFAULT_AI_POLICY;
  (el('campaignAiPolicy') as HTMLSelectElement).value=resolved.kind;
  (el('campaignClassicGrade') as HTMLSelectElement).value=String(resolved.kind==='classic-dos'?resolved.grade:1);
  syncCampaignClassicGrade();
}

export function applyRecipeToMenu(recipe:MapRecipe):void{
  (el('campaignLayout') as HTMLSelectElement).value=recipe.layout;
  (el('campaignAlgorithm') as HTMLSelectElement).value=recipe.algorithm;
  (el('campaignDensity') as HTMLSelectElement).value=recipe.density;
  (el('campaignSeedSource') as HTMLSelectElement).value='custom';
  (el('campaignSeed') as HTMLInputElement).value=String(recipe.seed);
  syncCampaignSeedControls();
}

export function currentMenuRecipe():MapRecipe{
  const layoutRaw=(el('campaignLayout') as HTMLSelectElement).value;
  const algorithmRaw=(el('campaignAlgorithm') as HTMLSelectElement).value;
  const densityRaw=(el('campaignDensity') as HTMLSelectElement).value;
  if(!isCampaignLayout(layoutRaw))throw new Error('Choose a valid layout.');
  if(!isMapAlgorithm(algorithmRaw))throw new Error('Choose a valid generator.');
  if(!isCityDensity(densityRaw))throw new Error('Choose a valid city density.');
  const seed=parseCampaignSeed((el('campaignSeed') as HTMLInputElement).value);
  if(seed===null)throw new Error('Enter a positive integer seed between 1 and 4294967295.');
  return mapRecipeFromCampaign({layout:layoutRaw,seed,algorithm:algorithmRaw,density:densityRaw});
}
