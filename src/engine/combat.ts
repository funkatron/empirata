/**
 * Interstel 2.05 manual-based combat resolution.
 *
 * Verified by the Interstel IBM PC 2.05 manual, "Setting the efficiency ratings"
 * and "Combat": at ordinary 50% combat efficiency each combat hit is equally
 * likely to be delivered by either side. Combat efficiencies weight those
 * chances; hit strength is determined solely by unit type. Cities are captured
 * using the attacking faction's combat efficiency (50% in the default mode).
 *
 * The Interstel DOS 2.05C RNG recurrence has been recovered and is now used.
 * Exact original seeding and RNG call ordering remain unverified; outcomes
 * are deterministic for an Empirata seed, but DOS turn-for-turn parity is not claimed.
 */
import type {Game} from './types.js';
import {nextRandom} from './rng.js';
import {STATS} from './units.js';
import {adjudicateCombat,adjudicateCityCapture,type HitBy} from './adjudication.js';

function combatEfficiency(game:Game, owner:string):number {
  const p=game.players.find(x=>x.id===owner);
  if(!p||!Number.isFinite(p.combatEfficiency)||p.combatEfficiency<0||p.combatEfficiency>100){
    throw new Error('Combat efficiency must be between 0 and 100.');
  }
  return p.combatEfficiency;
}

/** Resolve a one-against-one fight using the manual's weighted hit allocation. */
export function resolveCombat(game:Game, attackerId:string, defenderId:string):Game {
  const attacker=game.units.find(u=>u.id===attackerId);
  const defender=game.units.find(u=>u.id===defenderId);
  if(!attacker||!defender)throw new Error('Both combatants must exist.');
  const attackRating=combatEfficiency(game,attacker.owner);
  const defendRating=combatEfficiency(game,defender.owner);
  if(attackRating+defendRating<=0)throw new Error('At least one side must have a positive combat efficiency.');
  const attackChance=attackRating/(attackRating+defendRating);
  let attackDamage=attacker.damage,defendDamage=defender.damage;
  let random=game.rng;
  const hits:HitBy[]=[];
  // Every hit inflicts >=1 damage, so a legal fight should finish in <=24 hits;
  // this is a safety bound against corrupt saves, not a gameplay limitation.
  for(let i=0;i<100;i++){
    const {next,value}=nextRandom(random);random=next;
    const by:HitBy=value<attackChance?'attacker':'defender';
    hits.push(by);
    if(by==='attacker')defendDamage+=STATS[attacker.kind].hitDamage;
    else attackDamage+=STATS[defender.kind].hitDamage;
    if(defendDamage>=STATS[defender.kind].hitPoints||attackDamage>=STATS[attacker.kind].hitPoints)break;
  }
  if(attackDamage<STATS[attacker.kind].hitPoints&&defendDamage<STATS[defender.kind].hitPoints){
    throw new Error('Combat exceeded the safety limit.');
  }
  const result=adjudicateCombat(game,{attackerId,defenderId,hits});
  result.rng=random;
  return result;
}

/** One city conquest roll per army assault. A defeated army is lost. */
export function resolveCityAssault(game:Game, armyId:string, cityId:string):Game {
  const army=game.units.find(u=>u.id===armyId);
  if(!army)throw new Error('Attacking army does not exist.');
  const chance=combatEfficiency(game,army.owner)/100;
  const {next,value}=nextRandom(game.rng);
  const result=adjudicateCityCapture(game,{armyId,cityId,outcome:value<chance?'captured':'repelled'});
  result.rng=next;
  return result;
}
