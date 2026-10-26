/**
 * CLOSE QUARTERS: intentionally constructed QA encounter, never a claim about
 * authentic Empire openings, combat probabilities or autonomous AI.
 * Nearby threats are real on the map. Combat and conquest use documented
 * manual probabilities and the local seeded random stream, never hand-picked
 * results. Red opponent uses a preliminary rules-bound AI.
 */
import type { Game, Unit } from './types.js';
import {makeRulesLab} from './game.js';
import {updateAllKnowledge} from './knowledge.js';

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
