/**
 * CLOSE QUARTERS: intentionally constructed QA encounter, never a claim about
 * authentic Empire openings, combat probabilities or autonomous AI.
 * Nearby threats are real on the map. Combat and conquest use documented
 * manual probabilities and the local seeded random stream, never hand-picked
 * results. Red opponent uses a preliminary rules-bound AI.
 */
import type { Game, Unit } from './types.js';
import {makeRulesLab} from './game.js';
import {emptyKnowledge,updateAllKnowledge} from './knowledge.js';

export function makeCloseQuartersLab():Game {
  const g=makeRulesLab();
  g.scenario='close-quarters';
  const blueArmy=g.units.find(u=>u.id==='u1')!;
  const blueDestroyer=g.units.find(u=>u.id==='u2')!;
  const redArmy=g.units.find(u=>u.id==='u3')!;
  redArmy.position={x:10,y:25};
  const add=(base:Unit,changes:Partial<Unit>):void=>{
    g.units.push({...structuredClone(base),...changes,id:`u${g.nextId++}`});
  };
  // Additional friendly armies make assaults repeatable without a reset even
  // when the first attacker is lost or absorbed as a city garrison.
  add(blueArmy,{position:{x:9,y:23},damage:0,spent:0});
  add(blueArmy,{position:{x:11,y:23},damage:0,spent:0});
  // Destroyer detects the submerged enemy immediately; both start in water.
  add(blueDestroyer,{owner:'red',kind:'submarine',position:{x:6,y:25},damage:0,spent:0});
  // Adjacent transport/army pair for testing real embarkation and landings.
  add(blueDestroyer,{kind:'transport',position:{x:7,y:26},damage:0,spent:0});
  add(blueArmy,{kind:'army',position:{x:8,y:26},damage:0,spent:0});
  // Carrier/fighter pair in sheltered water for refueling and launch testing.
  add(blueDestroyer,{kind:'carrier',position:{x:4,y:26},damage:0,spent:0});
  add(blueArmy,{kind:'fighter',position:{x:5,y:26},fuel:8,damage:0,spent:0});
  // Additional short-range land/air encounter, without stacking on another unit.
  add(blueArmy,{owner:'blue',kind:'fighter',position:{x:9,y:26},damage:0,spent:0,fuel:20});
  add(blueArmy,{owner:'red',kind:'fighter',position:{x:10,y:27},damage:0,spent:0,fuel:20});
  g.cities.push({id:'c-frontier',position:{x:10,y:24},owner:null,production:null,progress:0,firstCycle:true});
  // The original distant player city and neutral cities are retained for
  // map/production testing. This is not a balanced historical setup.
  updateAllKnowledge(g);
  g.events.push({id:g.nextEventId++,round:1,recipient:'blue',kind:'system',
    message:'Close Quarters: select a blue unit, then an adjacent enemy or gold city. Combat and capture use the Interstel manual probabilities; Red responds during the next round using the same combat rules.'});
  return g;
}

/** Tiny, deterministic island assault demonstration; NOT an Interstel map. */
export function makeAiInvasionLab():Game {
  const g=makeRulesLab();
  g.scenario='ai-invasion';
  g.rng={seed:1,draws:0};
  for(let y=28;y<=32;y++)for(let x=72;x<=83;x++)
    g.tiles[y*g.width+x]='sea';
  for(const x of [74,75])g.tiles[29*g.width+x]='land';
  g.cities.push({id:'invasion-outpost',position:{x:74,y:29},owner:'blue',
    production:null,progress:0,firstCycle:true});
  const army=g.units.find(u=>u.id==='u3')!;
  army.position={x:81,y:30};army.aboard='red-transport';
  const ship:Unit={...structuredClone(army),id:'red-transport',kind:'transport',
    position:{x:81,y:30},aboard:null,fuel:null};
  g.units.push(ship);
  const scout:Unit={...structuredClone(army),id:'red-scout',aboard:null,position:{x:74,y:30}};
  // Red knows the outpost from scouting, but gains no continuing omniscience.
  g.units.push(scout);
  updateAllKnowledge(g);
  g.units=g.units.filter(u=>u.id!=='red-scout');
  updateAllKnowledge(g);
  g.events.push({id:g.nextEventId++,round:1,recipient:'blue',kind:'system',
    message:'AI Invasion demonstration: a loaded Red transport is approaching your Blue island outpost. End rounds to watch its naval approach and landing.'});
  return g;
}

/** Two autonomous opponents, using the same provisional rules-bound strategy.
 * Uses a constructed skirmish so combat begins quickly; not a DOS AI claim. */
export function makeAiVsAiSkirmishLab():Game {
  const g=makeCloseQuartersLab();
  g.scenario='ai-vs-ai';
  g.events.push({id:g.nextEventId++,round:g.round,recipient:null,kind:'system',
    message:'AI versus AI laboratory: both factions act automatically. Advance rounds to observe a deterministic skirmish.'});
  return g;
}

/** Clean production opening on the lab terrain; exact DOS placement is unverified. */
export function makeAiVsAiLab():Game {
  const g=makeRulesLab();
  g.scenario='ai-vs-ai';g.units=[];g.nextId=1;g.events=[];g.nextEventId=1;
  for(const faction of ['blue','red','green'] as const)g.knowledge[faction]=emptyKnowledge(g);
  updateAllKnowledge(g);
  g.events.push({id:g.nextEventId++,round:1,recipient:null,kind:'system',
    message:'Clean computer campaign: one city each, no starting units. Production begins on each faction turn. Lab terrain; original DOS placement is not verified.'});
  return g;
}
