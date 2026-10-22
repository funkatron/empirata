/**
 * Historical outcome ADJUDICATION, not a combat RNG implementation.
 * The Interstel manual establishes what happens after each hit or city conquest,
 * but not the exact hit-order algorithm / city-attack probability. The caller
 * supplies an externally verified (or intentionally scripted TEST) result.
 * These functions must not be wired to an ordinary game's automatic combat flow
 * until the probability resolver has been validated against the original.
 */
import type { City, Coord, FactionId, Game, Unit } from './types.js';
import {STATS, movementAllowance} from './units.js';
import {playable, terrainAt, cityAt, equal, isCoastal} from './world.js';
import {updateAllKnowledge} from './knowledge.js';

export type HitBy = 'attacker' | 'defender';
export type CombatRecord = {attackerId:string; defenderId:string; hits:HitBy[]};
export type CaptureRecord = {armyId:string; cityId:string; outcome:'captured'|'repelled'};
function oneStep(a:Coord,b:Coord):boolean {
  return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;
}
function log(g:Game, owner:FactionId, message:string):void {
  g.events.push({id:g.nextEventId++,round:g.round,recipient:owner,kind:'combat',message});
  if(g.events.length>300)g.events.shift();
}
function ready(g:Game, unitId:string, type?:string):Unit {
  const unit=g.units.find(u=>u.id===unitId);
  if(!unit||unit.owner!==g.active||unit.aboard)throw new Error('An active, unembarked friendly unit is required.');
  if(type&&unit.kind!==type)throw new Error(`A ${type} is required.`);
  if(unit.order.kind==='sentry')throw new Error('Clear sentry before manually attacking.');
  if(unit.spent>=movementAllowance(unit))throw new Error('No movement remains.');
  return unit;
}
function removeUnitAndCargo(g:Game, id:string):void {
  const doomed=new Set([id]);
  for(let changed=true;changed;){
    changed=false;
    for(const unit of g.units)if(unit.aboard&&doomed.has(unit.aboard)&&!doomed.has(unit.id)){
      doomed.add(unit.id);changed=true;
    }
  }
  g.units=g.units.filter(u=>!doomed.has(u.id));
}
function legalAttack(g:Game,attacker:Unit,defender:Unit):{advances:boolean} {
  if(attacker.owner===defender.owner||attacker.id===defender.id)throw new Error('Cannot attack a friendly unit.');
  if(defender.aboard)throw new Error('Embarked units cannot be targeted separately.');
  if(!oneStep(attacker.position,defender.position))throw new Error('Combat requires an adjacent target.');
  const city=cityAt(g,defender.position);
  if(city&&city.owner!==attacker.owner)throw new Error('A hostile city requires an army capture attempt, not unit combat.');
  if(attacker.kind==='army'&&defender.kind==='submarine')throw new Error('Armies cannot attack submarines.');
  if((attacker.kind==='destroyer'||attacker.kind==='transport'||attacker.kind==='submarine')&&defender.kind==='army'){
    throw new Error('That naval unit cannot attack armies.');
  }
  if(attacker.kind==='submarine'&&defender.kind==='fighter')throw new Error('Submarines cannot initiate fighter attacks.');
  const terrain=terrainAt(g,defender.position);
  if(attacker.kind==='army'&&terrain==='sea'&&!city)return {advances:false}; // Coastal attack, army cannot enter water
  if(STATS[attacker.kind].domain==='sea'&&terrain==='land'&&!city){
    if((attacker.kind!=='cruiser'&&attacker.kind!=='battleship')||defender.kind!=='army'||!isCoastal(g,defender.position)){
      throw new Error('Only cruisers and battleships can bombard coastal armies.');
    }
    return {advances:false};
  }
  if(STATS[attacker.kind].domain==='sea'&&city&&!isCoastal(g,city.position))throw new Error('A ship cannot enter an inland city.');
  if(!playable(g,defender.position))throw new Error('The border is impassable.');
  return {advances:true};
}
/** Replays a supplied FINISHED hit sequence; does not make chance decisions. */
export function adjudicateCombat(game:Game, record:CombatRecord):Game {
  if(!record.hits.length||record.hits.length>1000)throw new Error('Supply a bounded, nonempty hit sequence.');
  const g=structuredClone(game);
  const attacker=ready(g,record.attackerId), defender=g.units.find(u=>u.id===record.defenderId);
  if(!defender)throw new Error('Target does not exist.');
  const {advances}=legalAttack(g,attacker,defender);
  let defeated:Unit|null=null;
  for(let i=0;i<record.hits.length;i++){
    const by=record.hits[i];
    if(by!=='attacker'&&by!=='defender')throw new Error('Invalid hit source.');
    const target=by==='attacker'?defender:attacker;
    const source=by==='attacker'?attacker:defender;
    target.damage+=STATS[source.kind].hitDamage;
    if(target.damage>=STATS[target.kind].hitPoints){
      if(i!==record.hits.length-1)throw new Error('A hit sequence cannot continue after a unit is destroyed.');
      defeated=target;
      break;
    }
  }
  if(!defeated)throw new Error('A battle must end with exactly one destroyed combatant.');
  const winner=defeated===attacker?defender:attacker;
  const lostOwner=defeated.owner,winningOwner=winner.owner;
  removeUnitAndCargo(g,defeated.id);
  if(winner.id===attacker.id){
    attacker.spent++;
    if(advances)attacker.position={...defender.position};
    if(attacker.kind==='fighter'){
      attacker.fuel=(attacker.fuel??20)-1;
      const arrival=cityAt(g,attacker.position);
      if(arrival?.owner===attacker.owner)attacker.fuel=20;
      else if(attacker.fuel<=0)removeUnitAndCargo(g,attacker.id);
    }
  }
  log(g,winningOwner,`${winner.kind} ${winner.id} defeated ${defeated.kind} ${defeated.id}${advances&&winner.id===attacker.id?' and advanced':''}.`);
  log(g,lostOwner,`${defeated.kind} ${defeated.id} was destroyed in combat with ${winner.kind} ${winner.id}.`);
  updateAllKnowledge(g);
  return g;
}
/** City outcome supplied by a manual reference test; no invented capture odds. */
export function adjudicateCityCapture(game:Game, record:CaptureRecord):Game {
  if(!['captured','repelled'].includes(record.outcome))throw new Error('Invalid city resolution.');
  const g=structuredClone(game),army=ready(g,record.armyId,'army');
  const city=g.cities.find(c=>c.id===record.cityId);
  if(!city)throw new Error('Unknown city.');
  if(city.owner===army.owner)throw new Error('City is already friendly.');
  if(!oneStep(army.position,city.position))throw new Error('The army must be adjacent to the city.');
  if(!playable(g,city.position))throw new Error('The city is outside the playable map.');
  if(record.outcome==='repelled'){
    removeUnitAndCargo(g,army.id);
    log(g,army.owner,`${army.id} was lost attacking ${city.id}.`);
    if(city.owner)log(g,city.owner,`${city.id} repelled an attacking army.`);
  } else {
    const previousOwner=city.owner;
    // All units occupying a captured city are destroyed; cargo perishes with its ship.
    for(const resident of g.units.filter(u=>!u.aboard&&equal(u.position,city.position))){
      removeUnitAndCargo(g,resident.id);
    }
    removeUnitAndCargo(g,army.id); // Victorious army becomes an immobile city garrison
    city.owner=army.owner;
    // Captured-city production transfer/initialization timing needs executable verification.
    // The lab leaves the city's factory unassigned instead of copying enemy production.
    city.production=null;city.progress=0;city.firstCycle=true;
    log(g,army.owner,`${city.id} captured. ${army.id} joined its permanent garrison. Assign production.`);
    if(previousOwner)log(g,previousOwner,`${city.id} was captured by an enemy army.`);
  }
  updateAllKnowledge(g);
  return g;
}
