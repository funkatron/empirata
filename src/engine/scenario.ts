/**
 * CLOSE QUARTERS: intentionally constructed QA encounter, never a claim about
 * authentic Empire openings, combat probabilities or autonomous AI.
 * Nearby threats are real on the map; only the winning side is prescribed by
 * the human in the diagnostic UI. All consequences use adjudication.ts.
 */
import type { Game, Unit } from './types.js';
import {makeRulesLab} from './game.js';
import {adjudicateCombat,adjudicateCityCapture, type HitBy} from './adjudication.js';
import {getPlayerView,updateAllKnowledge} from './knowledge.js';
import {STATS} from './units.js';

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
  // Destroyer detects the submerged enemy immediately; both start in water.
  add(blueDestroyer,{owner:'red',kind:'submarine',position:{x:6,y:25},damage:0,spent:0});
  // Additional short-range land/air encounter, without stacking on another unit.
  add(blueArmy,{owner:'blue',kind:'fighter',position:{x:9,y:26},damage:0,spent:0,fuel:20});
  add(blueArmy,{owner:'red',kind:'fighter',position:{x:10,y:27},damage:0,spent:0,fuel:20});
  g.cities.push({id:'c-frontier',position:{x:10,y:24},owner:null,production:null,progress:0,firstCycle:true});
  // The original distant player city and neutral cities are retained for
  // map/production testing. This is not a balanced historical setup.
  updateAllKnowledge(g);
  g.events.push({id:g.nextEventId++,round:1,recipient:'blue',kind:'system',
    message:'Close Quarters QA fixture: enemy army, fighter, submarine, and neutral city are adjacent. Select blue unit, then target; scripted outcome is chosen explicitly, not rolled.'});
  return g;
}
function available(game:Game):void {
  if(game.mode!=='rules-lab'||game.scenario!=='close-quarters'||game.active!=='blue'){
    throw new Error('Scripted encounters are available only in the Close Quarters QA scenario on the blue turn.');
  }
}
/** Select the battle winner explicitly. This NEVER computes combat probability. */
export function scriptedLabCombat(game:Game,attackerId:string,defenderId:string,winner:'attacker'|'defender'):Game {
  available(game);
  const attacker=game.units.find(u=>u.id===attackerId),defender=game.units.find(u=>u.id===defenderId);
  if(!attacker||!defender||attacker.owner!=='blue'||defender.owner==='blue')throw new Error('Choose a friendly attacker and enemy defender.');
  if(!getPlayerView(game,'blue').enemies.some(s=>s.id===defenderId&&!s.stale))throw new Error('The enemy must currently be visible.');
  const winnerUnit=winner==='attacker'?attacker:defender;
  const loserUnit=winner==='attacker'?defender:attacker;
  const hitsNeeded=Math.ceil((STATS[loserUnit.kind].hitPoints-loserUnit.damage)/STATS[winnerUnit.kind].hitDamage);
  if(hitsNeeded<1||hitsNeeded>100)throw new Error('Invalid combat fixture health.');
  const hits=Array.from({length:hitsNeeded},()=>winner as HitBy);
  return adjudicateCombat(game,{attackerId,defenderId,hits});
}
/** Select success/failure of an adjacent assault; no capture odds are computed. */
export function scriptedLabCapture(game:Game,armyId:string,cityId:string,outcome:'captured'|'repelled'):Game {
  available(game);
  const intel=getPlayerView(game,'blue').cells;
  const city=game.cities.find(c=>c.id===cityId);
  if(!city||!intel[city.position.y*game.width+city.position.x]?.city)throw new Error('The target city must be discovered.');
  return adjudicateCityCapture(game,{armyId,cityId,outcome});
}
