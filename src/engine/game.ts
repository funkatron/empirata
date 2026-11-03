Warning: truncated output (original token count: 24114)
Total output lines: 1573

import { gameOutcome } from './presentation.js';
import { unitLabel } from './unit-names.js';
import type { City, Coord, FactionId, Game, Terrain, Unit, UnitOrder, UnitType } from './types.js';
import {MAX_FIGHTER_FUEL, movementAllowance, requiredProductionTurns, STATS, capacity } from './units.js';
import {MAP_HEIGHT,MAP_WIDTH, makeTestTerrain, playable, index, terrainAt, cityAt, equal, isCoastal, directions } from './world.js';
import {emptyKnowledge,updateAllKnowledge,getPlayerView} from './knowledge.js';
import {resolveCombat,resolveCityAssault} from './combat.js';

export class RuleNotImplemented extends Error {
  constructor(public readonly code:string,message:string){super(message);this.name='RuleNotImplemented';}
}
function clone(g:Game):Game{return structuredClone(g);}
function log(g:Game,recipient:FactionId|null,kind:Game['events'][number]['kind'],message:string):void {
  g.events.push({id:g.nextEventId++,round:g.round,recipient,kind,message});
  if(g.events.length>300) g.events.shift();
}
function newUnit(g:Game,owner:FactionId,kind:UnitType,position:Coord):Unit {
  return {id:`u${g.nextId++}`,owner,kind,position:{...position},damage:0,spent:0,
    fuel:kind==='fighter'?MAX_FIGHTER_FUEL:null,order:{kind:'none'},aboard:null};
}
export function makeRulesLab():Game {
  const tiles=makeTestTerrain();
  const mkCity=(id:string,x:number,y:number,owner:FactionId|null):City=>({id,position:{x,y},owner,
    production:null,progress:0,firstCycle:true});
  const cities=[mkCity('c-blue',8,25,'blue'),mkCity('c-red',80,36,'red'),
    ...([[20,16],[24,40],[33,24],[53,11],[67,24],[69,40],[52,50],[83,20]] as [number,number][])
    .map(([x,y],i)=>mkCity(`c${i+1}`,x,y,null))];
  const g:Game={schema:1,ruleset:'interstel-2.05',mode:'rules-lab',scenario:'classic-lab',width:MAP_WIDTH,height:MAP_HEIGHT,tiles,
    players:[{id:'blue',label:'Blue',combatEfficiency:50,productionEfficiency:50},
      {id:'red',label:'Red',combatEfficiency:50,productionEfficiency:50}],
    active:'blue',round:1,cities,units:[],knowledge:{blue:undefined!,red:undefined!,green:undefined!},
    rng:{seed:20261021,draws:0},nextId:1,nextEventId:1,events:[]};
  // Lab-only starting units bypass original starting conditions intentionally.
  g.units.push(newUnit(g,'blue','army',{x:9,y:25}));
  g.units.push(newUnit(g,'blue','destroyer',{x:7,y:25}));
  g.units.push(newUnit(g,'red','army',{x:79,y:36}));
  for(const faction of ['blue','red','green'] as const) g.knowledge[faction]=emptyKnowledge(g);
  updateAllKnowledge(g);
  log(g,'blue','system','Rules laboratory loaded. Manual-based combat and city assaults are active; cargo and autopilot orders are unfinished.');
  return g;
}
export function selectProduction(game:Game,cityId:string,kind:UnitType):Game {
  const g=clone(game);
  const city=g.cities.find(c=>c.id===cityId);
  if(!city||city.owner!==g.active) throw new Error('You can only set production in your own cities on your turn.');
  if(!STATS[kind]) throw new Error('Unknown unit type');
  if(STATS[kind].domain==='sea'&&!isCoastal(g,city.position)) throw new Error('Inland cities cannot build ships.');
  if(city.production===kind) return g;
  city.production=kind;city.progress=0;city.firstCycle=true;
  log(g,city.owner,'production',`Production set to ${STATS[kind].name} at ${city.id}; previous progress discarded.`);
  updateAllKnowledge(g);return g;
}
/** Load any available adjacent or co-located friendly troops while respecting capacity. */
function fillShip(g:Game,ship:Unit,portOnly=false,protectedCargo:ReadonlySet<string>=new Set()):number {
  const cargoKind=ship.kind==='transport'?'army':'fighter';
  const capacityNow=capacity(ship)??0;
  let occupied=g.units.filter(u=>u.aboard===ship.id).length,loaded=0;
  for(const candidate of g.units){
    if(occupied>=capacityNow)break;
    if(candidate.owner!==ship.owner||candidate.kind!==cargoKind||candidate.aboard||
       candidate.id===ship.id||protectedCargo.has(candidate.id))continue;
    if(portOnly&&!equal(candidate.position,ship.position))continue;
    if(Math.max(Math.abs(candidate.position.x-ship.position.x),
                Math.abs(candidate.position.y-ship.position.y))>1)continue;
    // Load Ship explicitly wakes nearby sentry troops. The army/fighter finishes
    // its turn aboard rather than getting a second move during loading.
    candidate.aboard=ship.id;
    candidate.position={...ship.position};
    candidate.spent=movementAllowance(candidate);
    candidate.order={kind:'none'};
    if(candidate.kind==='fighter')candidate.fuel=MAX_FIGHTER_FUEL;
    occupied++;loaded++;
    log(g,ship.owner,'movement',`${unitLabel(candidate)} loaded aboard ${unitLabel(ship)}.`);
  }
  if(occupied>=capacityNow&&ship.order.kind==='load-ship')ship.order={kind:'none'};
  return loaded;
}
/** Station a troop transport or carrier for automatic loading until full. */
export function loadShip(game:Game,shipId:string):Game {
  const g=clone(game),ship=g.units.find(u=>u.id===shipId);
  if(!ship||ship.owner!==g.active||ship.aboard||
     (ship.kind!=='transport'&&ship.kind!=='carrier'))
    throw new Error('Load Ship requires an active friendly transport or carrier.');
  ship.order={kind:'load-ship'};
  fillShip(g,ship);
  updateAllKnowledge(g);
  return g;
}
/** Wake embarked units; landing remains an individual, legal movement action. */
export function unloadShip(game:Game,shipId:string):Game {
  const g=clone(game),ship=g.units.find(u=>u.id===shipId);
  if(!ship||ship.owner!==g.active||ship.aboard||
     (ship.kind!=='transport'&&ship.kind!=='carrier'))
    throw new Error('Unload Ship requires an active friendly transport or carrier.');
  const cargo=g.units.filter(u=>u.aboard===ship.id);
  for(const unit of cargo)unit.order={kind:'none'};
  ship.order={kind:'none'};
  log(g,ship.owner,'movement',`${unitLabel(ship)}: ${cargo.length} embarked units ready for individual landing orders.`);
  updateAllKnowledge(g);
  return g;
}
export function setOrder(game:Game,unitId:string,order:UnitOrder):Game {
  if(order.kind==='load-ship')return loadShip(game,unitId);
  if(order.kind==='unload-ship')return unloadShip(game,unitId);
  if(!['sentry','skip','none','move-to','go-direction','patrol','go-home','escort'].includes(order.kind)) throw new RuleNotImplemented('STANDING_ORDERS','This standing order is not implemented yet.');
  const g=clone(game),unit=g.units.find(u=>u.id===unitId);
  if(!unit||unit.owner!==g.active) throw new Error('Unit not available to the active player.');
  if(order.kind==='sentry'&&unit.kind==='fighter'&&!unit.aboard&&
    cityAt(g,unit.position)?.owner!==unit.owner)
    throw new Error('Sentry requires a fighter to be based in a friendly city or aboard a carrier.');
  if(order.kind==='move-to'){
    if(!playable(g,order.destination))throw new Error('Destination must be inside the playable map.');
    if(unit.kind==='fighter'&&Math.max(Math.abs(order.destination.x-unit.position.x),Math.abs(order.destination.y-unit.position.y))>(unit.fuel??0))
      throw new Error('Move To destination exceeds remaining fighter fuel.');
    if(equal(unit.position,order.destination))unit.order={kind:'none'};
    else unit.order={kind:'move-to',destination:{...order.destination}};
  }else if(order.kind==='go-direction'){
    const {x,y}=order.direction;
    if(!Number.isInteger(x)||!Number.isInteger(y)||Math.max(Math.abs(x),Math.abs(y))!==1)throw new Error('Choose one of eight compass directions.');
    unit.order={kind:'go-direction',direction:{x,y}};
  }else if(order.kind==='patrol'){
    if(!playable(g,order.to)||!playable(g,order.from)||!equal(order.from,unit.position)||equal(order.to,order.from))throw new Error('Patrol requires a different playable destination and current starting position.');
    if(unit.kind==='fighter'){
      const carrier=unit.aboard?g.units.find(u=>u.id===unit.aboard&&u.kind==='carrier'&&u.owner===unit.owner):undefined;
      if(!carrier&&cityAt(g,unit.position)?.owner!==unit.owner)
        throw new Error('Fighter patrol requires a friendly city or carrier base.');
      const distance=Math.max(Math.abs(order.to.x-order.from.x),Math.abs(order.to.y-order.from.y));
      if(distance>(carrier?6:10))throw new Error(`Fighter patrol exceeds ${carrier?6:10}-square base range.`);
      if(distance*2>(unit.fuel??0))throw new Error('Fighter patrol requires enough fuel for the return flight.');
    }
    unit.order={kind:'patrol',from:{...order.from},to:{...order.to},outbound:true};
  }else if(order.kind==='escort'){
    const target=g.units.find(u=>u.id===order.targetId);
    if(!target||target.id===unit.id||target.owner!==unit.owner||target.aboard)
      throw new Error('Escort requires another active friendly unit.');
    unit.order={kind:'escort',targetId:target.id};
  }else if(order.kind==='go-home'){
    if(!g.cities.some(city=>city.owner===unit.owner))throw new Error('No friendly home city.');
    unit.order={kind:'go-home'};
  }else unit.order={kind:order.kind};
  if(order.kind==='skip'){settleFighterLoiter(g,unit);unit.spent=movementAllowance(unit);updateAllKnowledge(g);}
  return g;
}
/** Move one army aboard an adjacent friendly troop transport. */
export function embarkArmy(game:Game,armyId:string,transportId:string):Game {
  const g=clone(game),army=g.units.find(u=>u.id===armyId),ship=g.units.find(u=>u.id===transportId);
  if(!army||!ship||army.kind!=='army'||ship.kind!=='transport'||army.owner!==g.active||ship.owner!==g.active||
    army.aboard||ship.aboard)throw new Error('Boarding requires an active friendly army and transport.');
  if(army.spent>=movementAllowance(army))throw new Error('Army has no movement remaining.');
  if(army.order.kind==='sentry')throw new Error('Clear sentry before boarding.');
  if(Math.max(Math.abs(army.position.x-ship.position.x),Math.abs(army.position.y-ship.position.y))>1)
    throw new Error('Army must be adjacent to the transport.');
  const aboard=g.units.filter(u=>u.aboard===ship.id);
  if(aboard.length>=(capacity(ship)??0))throw new Error('Transport is full.');
  army.aboard=ship.id;army.position={...ship.position};army.spent++;army.order={kind:'none'};
  if(ship.order.kind==='load-ship'&&aboard.length+1>=capacity(ship)!)ship.order={kind:'none'};
  log(g,army.owner,'movement',`${unitLabel(army)} boarded ${unitLabel(ship)} (${aboard.length+1}/${capacity(ship)}).`);
  updateAllKnowledge(g);
  return g;
}
/** Release an army from a transport into an adjacent legal land square. */
export function disembarkArmy(game:Game,armyId:string,to:Coord):Game {
  const g=clone(game),army=g.units.find(u=>u.id===armyId);
  if(!army||army.owner!==g.active||army.kind!=='army'||!army.aboard)
    throw new Error('Select an embarked friendly army.');
  const ship=g.units.find(u=>u.id===army.aboard);
  if(!ship||ship.kind!=='transport'||ship.owner!==g.active)throw new Error('Transport unavailable.');
  if(army.spent>=movementAllowance(army))throw new Error('Army has no movement remaining.');
  if(!playable(g,to)||Math.max(Math.abs(to.x-ship.position.x),Math.abs(to.y-ship.position.y))!==1)
    throw new Error('Landing must be adjacent to the transport.');
  const city=cityAt(g,to);
  if(terrainAt(g,to)!=='land'&&!city)throw new Error('An army must disembark onto land.');
  if(city&&city.owner!==army.owner)throw new Error('Capture hostile cities manually after landing.');
  if(g.units.some(u=>!u.aboard&&equal(u.position,to)&&(!city||u.owner!==army.owner)))
    throw new Error('Landing square occupied.');
  army.aboard=null;army.position={...to};army.spent++;army.order={kind:'none'};
  log(g,army.owner,'movement',`${unitLabel(army)} landed from ${unitLabel(ship)}.`);
  updateAllKnowledge(g);
  return g;
}
/** Embark a friendly fighter on a carrier; original exact refuel timing remains provisional. */
export function boardFighter(game:Game,fighterId:string,carrierId:string):Game {
  const g=clone(game),fighter=g.units.find(u=>u.id===fighterId),ship=g.units.find(u=>u.id===carrierId);
  if(!fighter||!ship||fighter.kind!=='fighter'||ship.kind!=='carrier'||fighter.owner!==g.active||
     ship.owner!==g.active||fighter.aboard||ship.aboard)
    throw new Error('Boarding requires a friendly active fighter and carrier.');
  if(fighter.order.kind==='sentry')throw new Error('Clear sentry before boarding.');
  if(fighter.spent>=movementAllowance(fighter))throw new Error('Fighter has no movement remaining.');
  if(Math.max(Math.abs(fighter.position.x-ship.position.x),Math.abs(fighter.position.y-ship.position.y))>1)
    throw new Error('Fighter must be adjacent to its carrier.');
  if(g.units.filter(u=>u.aboard===ship.id).length>=(capacity(ship)??0))
    throw new Error('Carrier is full.');
  fighter.position={...ship.position};fighter.aboard=ship.id;fighter.spent++;fighter.fuel=MAX_FIGHTER_FUEL;
  fighter.order={kind:'none'};
  if(ship.order.kind==='load-ship'&&g.units.filter(u=>u.aboard===ship.id).length>=capacity(ship)!)ship.order={kind:'none'};
  log(g,fighter.owner,'movement',`${unitLabel(fighter)} landed aboard ${unitLabel(ship)} and refueled.`);
  updateAllKnowledge(g);return g;
}
/** Launch a fighter from a carrier into an adjacent legal square. */
export function launchFighter(game:Game,fighterId:string,to:Coord):Game {
  const g=clone(game),fighter=g.units.find(u=>u.id===fighterId);
  if(!fighter||fighter.owner!==g.active||fighter.kind!=='fighter'||!fighter.aboard)
    throw new Error('Select an embarked friendly fighter.');
  const carrier=g.units.find(u=>u.id===fighter.aboard);
  if(!carrier||carrier.kind!=='carrier'||carrier.owner!==g.active)
    throw new Error('Carrier unavailable.');
  if(fighter.spent>=movementAllowance(fighter))throw new Error('Fighter has no movement remaining.');
  if(!playable(g,to)||Math.max(Math.abs(to.x-carrier.position.x),Math.abs(to.y-carrier.position.y))!==1)
    throw new Error('Launch square must be adjacent to the carrier.');
  if(g.units.some(u=>!u.aboard&&equal(u.position,to))||
    (cityAt(g,to)&&cityAt(g,to)!.owner!==fighter.owner))
    throw new Error('Launch square must be free of hostile or occupied contacts.');
  fighter.aboard=null;fighter.position={...to};fighter.spent++;
  fighter.fuel=(fighter.fuel??MAX_FIGHTER_FUEL)-1;
  const arrival=cityAt(g,to);
  if(arrival?.owner===fighter.owner)fighter.fuel=MAX_FIGHTER_FUEL;
  if(fighter.fuel<=0){
    g.units=g.units.filter(u=>u.id!==fighter.id);
    log(g,fighter.owner,'fuel',`${unitLabel(fighter)} ran out of fuel after launch.`);
  }else log(g,fighter.owner,'movement',`${unitLabel(fighter)} launched from ${unitLabel(carrier)}.`);
  updateAllKnowledge(g);return g;
}
export function moveUnit(game:Game,id:string,to:Coord,protectedCargo:ReadonlySet<string>=new Set()):Game {
  const g=clone(game),unit=g.units.find(u=>u.id===id);
  if(!unit||unit.owner!==g.active) throw new Error('That unit cannot be moved this turn.');
  if(unit.aboard) throw new RuleNotImplemented('CARGO','Transport unloading is not yet implemented.');
  if(unit.order.kind==='sentry'||unit.order.kind==='load-ship') throw new Error('Clear sentry or loading orders before moving.');
  if(unit.spent>=movementAllowance(unit)) throw new Error('No movement remaining this turn.');
  if(!playable(g,to)) throw new Error('The outer map border is impassable.');
  const dx=Math.abs(to.x-unit.position.x),dy=Math.abs(to.y-unit.position.y);
  if(Math.max(dx,dy)!==1) throw new Error('Manual movement must be one adjacent square.');
  const terrain=terrainAt(g,to);
  const domain=STATS[unit.kind].domain;
  const city=cityAt(g,to);
  const occupants=g.units.filter(u=>!u.aboard&&equal(u.position,to));
  const boarding=occupants.find(u=>u.owner===unit.owner&&u.kind==='transport');
  if(unit.kind==='army'&&boarding)return embarkArmy(game,id,boarding.id);
  const friendlyCarrier=occupants.find(u=>u.owner===unit.owner&&u.kind==='carrier');
  if(unit.kind==='fighter'&&friendlyCarrier)return boardFighter(game,id,friendlyCarrier.id);
  const enemy=occupants.find(u=>u.owner!==unit.owner);
  // Original rules allow armies to engage hostile ships in adjacent water, but
  // the victorious army does not advance onto the sea square. Heavy warships
  // likewise bombard coastal armies without moving onto land.
  const coastalAttack=enemy&&(
    (unit.kind==='army'&&terrain==='sea') ||
    ((unit.kind==='cruiser'||unit.kind==='battleship')&&terrain==='land'&&enemy.kind==='army')
  );
  if((domain==='land'&&terrain!=='land'&&!city&&!coastalAttack)||
     (domain==='sea'&&terrain!=='sea'&&!city&&!coastalAttack)) {
    throw new Error(`${STATS[unit.kind].name} cannot cross this terrain.`);
  }
  if(domain==='sea'&&city&&!isCoastal(g,city.position)) throw new Error('A ship cannot enter an inland city.');
  if(city&&city.owner!==unit.owner) {
    if(unit.kind==='army')return resolveCityAssault(game,id,city.id);
    throw new Error('Only armies may capture a neutral or enemy city.');
  }
  if(enemy)return resolveCombat(game,id,enemy.id);
  if(occupants.some(u=>u.owner===unit.owner)&&!city) throw new RuleNotImplemented('CARGO','Loading and same-cell stacking require verified original mechanics.');
  if((unit.kind==='transport'||unit.kind==='carrier')&&
    g.units.filter(u=>u.aboard===unit.id).length>(capacity(unit)??0))
    throw new Error('Ship is overloaded. Unload excess cargo before moving.');
  // Ships leaving a friendly port pick up eligible co-located troops automatically.
  const departurePort=cityAt(g,unit.position);
  if((unit.kind==='transport'||unit.kind==='carrier')&&departurePort?.owner===unit.owner)
    fillShip(g,unit,true,protectedCargo);
  unit.position={...to}; unit.spent++;
  // Embarked units physically travel with the ship, but spend no movement themselves.
  for(const cargo of g.units.filter(u=>u.aboard===unit.id))cargo.position={...to};
  if((unit.kind==='transport'||unit.kind==='carrier')&&city?.owner===unit.owner){
    for(const cargo of g.units.filter(u=>u.aboard===unit.id)){
      cargo.aboard=null;cargo.position={...to};
      if(cargo.kind==='fighter')cargo.fuel=MAX_FIGHTER_FUEL;
      log(g,cargo.owner,'movement',`${unitLabel(cargo)} unloaded in friendly port ${city.id}.`);
    }
  }
  if(unit.order.kind!=='none'&&unit.order.kind!=='skip')unit.order={kind:'none'};
  if(unit.kind==='fighter') {
    unit.fuel=(unit.fuel??MAX_FIGHTER_FUEL)-1;
    if(city?.owner===unit.owner) unit.fuel=MAX_FIGHTER_FUEL; // Timing to be verified.
    else if(unit.fuel<=0){
      g.units=g.units.filter(u=>u.id!==unit.id);
      log(g,unit.owner,'fuel',`${unitLabel(unit)} ran out of fuel and crashed.`);
    }
  }
  updateAllKnowledge(g);
  return g;
}
/** Route through the player's remembered map, not the real hidden terrain.
 * Unknown cells are considered for exploration and validated one step at a time.
 * No automated combat, assault or cargo loading is permitted.
 */
function routeStep(game:Game,unit:Unit,destination:Coord):Coord|null {
  const knowledge=game.knowledge[unit.owner];
  const goal=index(game,destination),start=index(game,unit.position);
  const visited=new Set<number>([start]),queue=[start],parent=new Map<number,number>();
  const visibleEnemies=new Set(game.knowledge[unit.owner].sightings
    .filter(s=>knowledge.freshEnemies.includes(s.id)).map(s=>index(game,s.position)));
  const friendly=new Set(game.units.filter(u=>!u.aboard&&u.owner===unit.owner&&u.id!==unit.id).map(u=>index(game,u.position)));
  const cities=new Map(game.cities.filter(c=>knowledge.cities[c.id]!==undefined).map(c=>[index(game,c.position),c]));
  const domain=STATS[unit.kind].domain;
  for(let head=0;head<queue.length;head++){
    const here=queue[head]!;if(here===goal)break;
    const x=here%game.width,y=Math.floor(here/game.width);
    for(const direction of directions){
      const pos={x:x+direction.x,y:y+direction.y};
      if(!playable(game,pos))continue;
      const k=index(game,pos);
      if(visited.has(k)||visibleEnemies.has(k)||(friendly.has(k)&&!game.cities.some(city=>knowledge.cities[city.id]?.owner===unit.owner&&equal(city.position,pos))))continue;
      const terrain=knowledge.terrain[k];
      const city=knowledge.terrain[k]!==null?cities.get(k):undefined;
      // Only use ownership learned from this player's knowledge.
      if(city&&(!knowledge.cities[city.id]||knowledge.cities[city.id]!.owner!==unit.owner))continue;
      if(terrain!==null){
        if(domain==='land'&&terrain!=='land'&&!city)continue;
        if(domain==='sea'&&terrain!=='sea'&&!city)continue;
        if(domain==='sea'&&city&&!directions.some(d=>knowledge.terrain[index(game,{x:pos.x+d.x,y:pos.y+d.y})]==='sea'))continue;
      }
      visited.add(k);parent.set(k,here);queue.push(k);
    }
  }
  if(!visited.has(goal))return null;
  let cursor=goal;
  while(parent.get(cursor)!==start){const previous=parent.get(cursor);if(previous===undefined)return null;cursor=previous;}
  return {x:cursor%game.width,y:Math.floor(cursor/game.width)};
}
/** Execute passive standing orders, never attacking or assaulting cities automatically. */
function executeStandingOrders(game:Game):Game {
  let g=game;
  const ordered=g.units.filter(u=>u.owner===g.active&&['move-to','go-direction','patrol','go-home','escort'].includes(u.order.kind)).map(u=>u.id);
  for(const id of ordered){
    for(let attempt=0;attempt<10;attempt++){
      const unit=g.units.find(u=>u.id===id);
      if(!unit||unit.spent>=movementAllowance(unit))break;
      const order=unit.order;
      if(order.kind!=='move-to'&&order.kind!=='go-direction'&&order.kind!=='patrol'&&order.kind!=='go-home'&&order.kind!=='escort')break;
      let step:Coord|null=null;
      let nextOrder:UnitOrder=structuredClone(order);
      if(order.kind==='go-direction'){
        step={x:unit.position.x+order.direction.x,y:unit.position.y+order.direction.y};
      }else if(order.kind==='go-home'){
        const homes=g.cities.filter(city=>city.owner===unit.owner)
          .sort((a,b)=>Math.max(Math.abs(a.position.x-unit.position.x),Math.abs(a.position.y-unit.position.y))-
            Math.max(Math.abs(b.position.x-unit.position.x),Math.abs(b.position.y-unit.position.y)));
        if(homes.some(city=>equal(unit.position,city.position))){unit.order={kind:'none'};break;}
        for(const home of homes){step=routeStep(g,unit,home.position);if(step)break;}
      }else if(order.kind==='escort'){
        const target=g.units.find(other=>other.id===order.targetId&&other.owner===unit.owner&&!other.aboard);
        if(!target){unit.order={kind:'none'};log(g,unit.owner,'movement',`${id}: escort target unavailable.`);break;}
        const distance=Math.max(Math.abs(target.position.x-unit.position.x),Math.abs(target.position.y-unit.position.y));
        if(distance<=1)break; // stay beside the escorted unit; do not stack
        const candidates=directions.map(d=>({x:target.position.x+d.x,y:target.position.y+d.y}))
          .filter(p=>playable(g,p)).sort((a,b)=>
            Math.max(Math.abs(a.x-unit.position.x),Math.abs(a.y-unit.position.y))-
            Math.max(Math.abs(b.x-unit.position.x),Math.abs(b.y-unit.position.y)));
        for(const p of candidates){step=routeStep(g,unit,p);if(step)break;}
      }else{
        let destination=order.kind==='move-to'?order.destination:(order.outbound?order.to:order.from);
        if(equal(unit.position,destination)){
          if(order.kind==='move-to'){unit.order={kind:'none'};break;}
          nextOrder={...order,outbound:!order.outbound};
          destination=order.outbound?order.from:order.to;
        }
        step=routeStep(g,unit,destination);
      }
      if(!step||!playable(g,step)){
        unit.order={kind:'none'};
        log(g,unit.owner,'movement',`${id}: no safe route; standing order cleared.`);
        break;
      }
      // Inspection of actual next-step occupancy is a movement collision check,
      // not an AI navigation hint. Never resolve a hostile contact automatically.
      const hostile=g.units.some(u=>!u.aboard&&u.owner!==unit.owner&&equal(u.position,step));
      const city=cityAt(g,step);
      if(hostile||(city&&city.ow…12114 tokens truncated…et g=game;
  const defenders=new Map<string,string>();
  for(const city of getPlayerView(g,faction).ownCities){
    const army=getPlayerView(g,faction).ownUnits.find(u=>u.kind==='army'&&!u.aboard&&equal(u.position,city.position));
    if(army)defenders.set(city.id,army.id);
  }
  const protectedCargo=new Set(defenders.values());
  // Troops with a known ground objective should not be swept back aboard at a
  // friendly supply port after landing. Keep this distinct from city guards:
  // assigned assault troops must still be allowed to move and capture.
  const boardingProtected=new Set(protectedCargo),groundView=getPlayerView(g,faction);
  for(const army of groundView.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&u.aiBeachhead&&
    groundView.cells.some(c=>c.city&&c.city.id===u.aiBeachhead&&c.city.owner!==faction))){
    if(protectedCargo.has(army.id))continue;
    const adjacent=groundView.cells.some((c,i)=>c.city&&c.city.owner!==faction&&
      Math.max(Math.abs(i%groundView.width-army.position.x),Math.abs(Math.floor(i/groundView.width)-army.position.y))<=1);
    if(adjacent||planAiGroundStep(groundView,army))boardingProtected.add(army.id);
  }
  const aiMove=(state:Game,id:string,to:Coord)=>moveUnit(state,id,to,boardingProtected);
  // Deterministic, knowledge-limited production. The AI assigns armies first;
  // a coastal city may switch to transport production once forces accumulate.
  // This is provisional strategy, NOT reverse-engineered historical AI.
  for(const city of getPlayerView(g,faction).ownCities){
    const ownUnits=getPlayerView(g,faction).ownUnits;
    const armyCount=aiLocalArmyReserve(getPlayerView(g,faction),city.position);
    const transportCount=ownUnits.filter(u=>u.kind==='transport').length;
    const view=getPlayerView(g,faction);
    const navalThreat=view.enemies.some(e=>!e.stale&&e.kind==='transport');
    // Transport protection survives casualties and the end of reconnaissance.
    // This is ongoing demand, not a fixed cap on fleet production.
    const desiredScouts=Math.max(navalThreat||transportCount>0?2:1,Math.ceil(view.ownCities.length/2));
    const scoutingAssigned=ownUnits.filter(u=>u.kind==='destroyer').length+
      view.ownCities.filter(c=>c.id!==city.id&&c.production==='destroyer').length>=desiredScouts;
    const knownObjective=view.cells.some(c=>c.city&&c.city.owner!==faction);
    const probe:Unit={id:'production-scout',kind:'destroyer',owner:faction,position:city.position,
      aboard:null,damage:0,spent:0,fuel:null,order:{kind:'none'}};
    const scoutNeeded=armyCount>=1&&!scoutingAssigned&&(!knownObjective||desiredScouts>1)&&
      isCoastal(g,city.position)&&(transportCount>0||navalThreat||planAiNavalScoutStep(view,probe)!==null);
    // Finish committed ships rather than repeatedly discarding their progress.
    const totalArmies=ownUnits.filter(u=>u.kind==='army').length;
    const hostileKnown=view.cells.some(c=>c.city&&c.city.owner!==null&&c.city.owner!==faction);
    const neutralKnown=view.cells.some(c=>c.city&&c.city.owner===null);
    const desiredTransports=Math.max(1,Math.ceil(totalArmies/6),
      hostileKnown&&totalArmies>=6?2:0,hostileKnown&&neutralKnown&&totalArmies>=12?3:0);
    const assignedTransports=transportCount+view.ownCities.filter(c=>c.id!==city.id&&c.production==='transport').length;
    const fighterCount=ownUnits.filter(u=>u.kind==='fighter').length;
    const carrierCount=ownUnits.filter(u=>u.kind==='carrier').length;
    const fighterTarget=Math.max(transportCount>0?2:1,Math.ceil(view.ownCities.length/2))+carrierCount*4;
    const fightersAssigned=fighterCount+view.ownCities.filter(c=>c.id!==city.id&&c.production==='fighter').length;
    const airProbe:Unit={...probe,kind:'fighter',fuel:20};
    const fighterNeeded=armyCount>=2&&fightersAssigned<fighterTarget&&planAiFighterStep(view,airProbe)!==null;
    const carrierNeeded=armyCount>=3&&transportCount>0&&fighterCount>=2&&
      ownUnits.some(u=>u.kind==='destroyer')&&carrierCount+view.ownCities.filter(c=>c.id!==city.id&&c.production==='carrier').length<Math.ceil(transportCount/2)&&isCoastal(g,city.position);
    const committedShip=city.progress>0&&
      (city.production==='destroyer'&&!scoutingAssigned||
       city.production==='transport'&&assignedTransports<desiredTransports||
       city.production==='fighter'&&fightersAssigned<fighterTarget||city.production==='carrier'&&fighterCount>=2&&carrierCount<Math.ceil(transportCount/2));
    const pick=!defenders.has(city.id)?'army':committedShip?city.production!:
      armyCount>=3&&assignedTransports<desiredTransports&&isCoastal(g,city.position)?'transport':fighterCount===0&&fighterNeeded?'fighter':scoutNeeded?'destroyer':
      carrierNeeded?'carrier':fighterNeeded?'fighter':'army';
    // Production time cannot be recovered: keep every factory active.
    if(city.production!==pick)g=selectProduction(g,city.id,pick);
  }
  const beachAssignments=new Map<string,string[]>(),beachWaiting=new Set<string>(),beachArmySteps=new Map<string,Coord>();
  for(const ship of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='transport')){
    const plan=planAiBeachPickup(getPlayerView(g,faction),ship,new Set([...boardingProtected,...beachWaiting]));
    if(plan){g=clone(g);const actual=g.units.find(u=>u.id===ship.id)!;actual.aiPickup={armies:ship.aiPickup?.armies??plan.armies,startedRound:ship.aiPickup?.startedRound??g.round};for(const [id,step] of Object.entries(plan.armySteps))beachArmySteps.set(id,step);beachAssignments.set(ship.id,actual.aiPickup.armies);for(const id of actual.aiPickup.armies)beachWaiting.add(id);}
    else if(ship.aiPickup){g=clone(g);delete g.units.find(u=>u.id===ship.id)!.aiPickup;}
  }
  // Loading consumes eligible troops' movement. Choose from own units only.
  for(const ship of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='transport'&&!u.aboard)){
    const nearArmy=getPlayerView(g,faction).ownUnits.some(u=>u.kind==='army'&&!u.aboard&&
      Math.max(Math.abs(u.position.x-ship.position.x),Math.abs(u.position.y-ship.position.y))<=1);
    const atLoadingPort=getPlayerView(g,faction).ownCities.some(c=>isCoastal(g,c.position)&&
      Math.max(Math.abs(c.position.x-ship.position.x),Math.abs(c.position.y-ship.position.y))<=1);
    // Never re-embark an invasion force at the enemy beachhead. Those armies
    // need their next turn to assault the city rather than cycling aboard.
    if(nearArmy&&(atLoadingPort||beachAssignments.has(ship.id))&&g.units.filter(u=>u.aboard===ship.id).length<(capacity(ship)??0)){
      for(const army of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&!boardingProtected.has(u.id)&&
        (atLoadingPort||beachAssignments.get(ship.id)?.includes(u.id)))){
        try{g=embarkArmy(g,army.id,ship.id);}catch{/* Only eligible nearby troops board. */}
      }
      // A partially filled AI transport may sail; do not keep it on a
      // stationary loading order forever.
      g=setOrder(g,ship.id,{kind:'none'});
    }
  }
  // Persist the discovered city mission across moves and turns. Only the
  // faction's remembered city ownership can select or invalidate a target.
  for(const ship of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='transport')){
    const view=getPlayerView(g,faction);
    const planned=updateAiTransportMission(view,ship);
    if(JSON.stringify(planned)!==JSON.stringify(ship)){
      g=clone(g);const actual=g.units.find(u=>u.id===ship.id)!;
      Object.assign(actual,planned);
      for(const key of ['aiObjective','aiMissionProgress','aiAvoidObjective'] as const)
        if(planned[key]===undefined)delete actual[key];
      if(planned.aiAvoidObjective?.id!==ship.aiAvoidObjective?.id&&planned.aiAvoidObjective)
        log(g,faction,'system',`${unitLabel(ship)} paused stalled objective ${planned.aiAvoidObjective.id} for 12 rounds.`);
      if(planned.aiObjective!==ship.aiObjective)
        log(g,faction,'system',planned.aiObjective?`${unitLabel(ship)} assigned city objective ${planned.aiObjective}.`:
          `${unitLabel(ship)} cleared its city objective.`);
    }
  }

  const assembling=new Set<string>();
  for(const ship of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='transport')){
    const plan=planAiTransportAssembly(getPlayerView(g,faction),ship);
    if(JSON.stringify(plan.ship.aiAssembly)!==JSON.stringify(ship.aiAssembly)){
      g=clone(g);const actual=g.units.find(u=>u.id===ship.id)!;
      if(plan.ship.aiAssembly)actual.aiAssembly=plan.ship.aiAssembly;else delete actual.aiAssembly;
      if(plan.ship.aiAssembly)log(g,faction,'system',`${unitLabel(ship)} assembling for ${plan.ship.aiAssembly.objective}; wait limited to 12 rounds.`);
    }
    if(plan.wait)assembling.add(ship.id);
  }
  // Prefer landing near a known hostile/neutral objective; never target an
  // undiscovered city or use hidden terrain for route selection.
  for(const ship of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='transport')){
    const view=getPlayerView(g,faction);
    const cargo=view.ownUnits.find(u=>u.kind==='army'&&u.aboard===ship.id&&u.spent<movementAllowance(u));
    const shore=assembling.has(ship.id)||beachAssignments.has(ship.id)?null:planAiReconLandingSquare(view,ship);
    if(cargo&&shore){try{g=disembarkArmy(g,cargo.id,shore);}catch{/* Actual movement remains authoritative. */}}
  }
  for(const landing of planAiLandingWave({...getPlayerView(g,faction),ownUnits:getPlayerView(g,faction).ownUnits.filter(u=>!assembling.has(u.id)&&!assembling.has(u.aboard??'')&&!beachAssignments.has(u.id)&&!beachAssignments.has(u.aboard??''))})){
    // Each landing refreshes intelligence. A newly exposed defender can make
    // later reserved cells unsafe even though disembarkArmy still permits them.
    const view=getPlayerView(g,faction);
    const cargo=view.ownUnits.find(u=>u.id===landing.armyId);
    const ship=view.ownUnits.find(u=>u.id===cargo?.aboard);
    if(!ship||!planAiLandingSquares(view,ship).some(p=>equal(p,landing.position)))continue;
    try {
      g=disembarkArmy(g,landing.armyId,landing.position);
      const landed=g.units.find(u=>u.id===landing.armyId);
      if(landed&&ship.aiObjective)landed.aiBeachhead=ship.aiObjective;
    }
    catch{/* Actual movement remains authoritative if a hidden contact blocks landing. */}
  }
  // Report genuine geographic blockages at a bounded cadence rather than
  // allowing silent centuries of stalled naval operations.
  if(g.round%10===0)for(const ship of getPlayerView(g,faction).ownUnits.filter(u=>
    u.kind==='transport'&&u.aboard===null&&g.units.some(c=>c.aboard===u.id))){
    const passable=directions.some(d=>{
      const p={x:ship.position.x+d.x,y:ship.position.y+d.y};
      return playable(g,p)&&(terrainAt(g,p)==='sea'||cityAt(g,p)?.owner===faction)&&
        !g.units.some(other=>other.id!==ship.id&&!other.aboard&&equal(other.position,p));
    });
    if(!passable)log(g,faction,'system',`${unitLabel(ship)} blocked at (${ship.position.x}, ${ship.position.y}): no accessible adjacent sea or friendly port.`);
  }
  // Launch ready embarked scouts through the ordinary carrier action. A return
  // flight can board/refuel normally; another sortie starts on a later AI turn.
  for(const id of getPlayerView(g,faction).ownUnits.filter(u=>u.kind==='fighter'&&u.aboard).map(u=>u.id)){
    const view=getPlayerView(g,faction),fighter=view.ownUnits.find(u=>u.id===id);
    if(!fighter||fighter.order.kind==='sentry'||fighter.spent>=movementAllowance(fighter))continue;
    const next=planAiFighterStep(view,fighter);if(!next)continue;
    try{g=launchFighter(g,id,next);}catch{/* Hidden or changed contacts interrupt launch. */}
  }
  const activeUnitIds=g.units.filter(u=>u.owner===faction&&!u.aboard).map(u=>u.id);
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  for(const id of activeUnitIds){
    for(let step=0;step<5;step++){
      const view=getPlayerView(g,faction);
      const unit=view.ownUnits.find(u=>u.id===id);
      if(!unit||unit.spent>=movementAllowance(unit)||unit.order.kind==='sentry')break;
      if(protectedCargo.has(id))break;
      if(beachWaiting.has(id)){const step=beachArmySteps.get(id);if(step){try{g=aiMove(g,id,step);}catch{/* Replan next turn if another troop blocks the path. */}}break;}
      if(assembling.has(id)){
        const recruiting=view.ownCities.some(c=>c.production==='army'&&distance(c.position,unit.position)<=1)&&
          view.ownUnits.filter(u=>u.aboard===id).length<(capacity(unit)??0);
        const staging=recruiting?null:planAiConvoyStaging(view,unit);
        if(staging?.next){try{g=aiMove(g,id,staging.next);continue;}catch{/* Reassess blocked station next turn. */}}
        break;
      }
      const intercept=planAiNavalTransportIntercept(view,unit);
      if(intercept){
        const attacking=view.enemies.some(e=>!e.stale&&e.kind==='transport'&&equal(e.position,intercept));
        try{g=aiMove(g,id,intercept);if(attacking)break;continue;}catch{break;}
      }
      if(unit.kind==='fighter'){
        const next=planAiFighterStep(view,unit);if(!next)break;
        try{g=aiMove(g,id,next);continue;}catch{break;}
      }
      // Initial carrier role: remain a safe refueling station. Moving naval air
      // groups require the subsequent carrier/patrol coordination milestone.
      if(unit.kind==='carrier')break;
      if(unit.kind==='transport'&&(!view.ownUnits.some(u=>u.aboard===id)||beachAssignments.has(id))){
        if(beachAssignments.has(id)){
          const own=new Set(beachAssignments.get(id));
          const excluded=new Set([...boardingProtected,...view.ownUnits.filter(a=>a.kind==='army'&&!own.has(a.id)).map(a=>a.id)]);
          const pickup=planAiBeachPickup(view,unit,excluded);
          if(pickup){if(!pickup.next)break;try{g=aiMove(g,id,pickup.next);continue;}catch{break;}}
          beachAssignments.delete(id);g=clone(g);delete g.units.find(u=>u.id===id)!.aiPickup;
          if(view.ownUnits.some(u=>u.aboard===id))continue; // Resume cargo mission, never empty-hull port routing.
        }

        // Empty transports return to known friendly ports for another load.
        // A ship already in port waits for troops instead of wandering away.
        const queued=new Map(view.ownCities.map(c=>{
          const region=aiGroundRegion(view,c.position);
          return [c.id,view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&!protectedCargo.has(u.id)&&
            distance(u.position,c.position)<=3&&region.has(u.position.y*view.width+u.position.x)).length];
        }));
        const ports=view.ownCities.filter(c=>isCoastal(g,c.position))
          .sort((a,b)=>queued.get(b.id)!-queued.get(a.id)!||
            distance(a.position,unit.position)-distance(b.position,unit.position));
        if(ports.length){
          if(equal(ports[0]!.position,unit.position))break;
          let returned=false;
          for(const port of ports){
            const step=routeStep(g,unit,port.position);
            if(!step)continue;
            try {g=aiMove(g,id,step);returned=true;break;}
            catch{/* An occupied or newly discovered square blocks this route. */}
          }
          if(returned)continue;
          break;
        }
      }
      if(unit.kind==='transport'&&view.ownUnits.some(u=>u.aboard===id)){
        const step=planAiInvasionStep(view,unit);
        // Once in landing range, hold station for the next available cargo turn.
        if(!step)break;
        try {g=aiMove(g,id,step);continue;}
        catch {break;} // Hidden contact interrupts the route; do not attack blindly.
      }
      // Combat ships handle nearby threats, then reconnaissance (destroyers),
      // convoy protection and coastal stations. This is experimental strategy.
      if(['destroyer','submarine','cruiser','battleship'].includes(unit.kind)){
        const adjacent=view.enemies.filter(e=>!e.stale&&(e.kind!=='army'||unit.kind==='cruiser'||unit.kind==='battleship')&&
          distance(e.position,unit.position)===1)
          .sort((a,b)=>Number(b.kind==='transport')-Number(a.kind==='transport')||a.id.localeCompare(b.id));
        let engaged=false;
        for(const target of adjacent){
          try{g=aiMove(g,id,target.position);engaged=true;break;}catch{/* Try the next legal contact. */}
        }
        if(engaged)break; // Resolve immediate threats before scouting or holding.
        const investigation=planAiNavalTransportIntercept(view,unit,true);
        if(investigation){try{g=aiMove(g,id,investigation);continue;}catch{break;}}
        const next=planAiNavalScoutStep(view,unit);
        if(next){
          try {g=aiMove(g,id,next);continue;}
          catch {break;}
        }
        // Reconnaissance exhausted: protect a loaded expedition instead of
        // drifting toward a map corner. Hold when adjacent, and reassess every
        // turn so fresh enemy contacts always retain priority over escort duty.
        const expeditions=view.ownUnits.filter(u=>u.kind==='transport'&&
          view.ownUnits.some(c=>c.aboard===u.id))
          .sort((a,b)=>distance(a.position,unit.position)-distance(b.position,unit.position)||a.id.localeCompare(b.id));
        const escort=expeditions[0];
        if(escort&&distance(escort.position,unit.position)>1){
          const stations=directions.map(d=>({x:escort.position.x+d.x,y:escort.position.y+d.y}))
            .filter(p=>playable(view,p)&&view.cells[p.y*view.width+p.x]?.terrain==='sea'&&
              !view.ownUnits.some(u=>!u.aboard&&equal(u.position,p)))
            .sort((a,b)=>distance(a,unit.position)-distance(b,unit.position));
          let repositioned=false;
          for(const station of stations){
            const step=routeStep(g,unit,station);if(!step)continue;
            try{g=aiMove(g,id,step);repositioned=true;break;}catch{/* Try another known station. */}
          }
          if(repositioned)continue;
        }
        if(escort)break; // Hold protection beside an active loaded transport.
        const station=planAiCoastalSentryStep(view,unit);
        if(station){try{g=aiMove(g,id,station);continue;}catch{break;}}
        break; // Coastal sentry is reassessed next turn, including fresh contacts.
      }
      const visibleEnemies=view.enemies.filter(e=>!e.stale);
      const knownCities=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!==faction?
        [{pos:{x:i%view.width,y:Math.floor(i/view.width)},city:cell.city}]:[]);
      // If no land route to a known objective exists, stage at a coastal port.
      // A known overseas city must not lure armies away from their transports.
      const groundPlan=unit.kind==='army'?planAiGroundStep(view,unit):null;
      // Scout from the opening turn, without waiting for a fleet or reserves.
      // Keep one active ground scout per nearby group. Other armies stage at ports
      // for transport loading rather than clogging the island with wanderers.
      const region=unit.kind==='army'?aiGroundRegion(view,unit.position):new Set<number>();
      const firstArmy=view.ownUnits.find(u=>u.kind==='army'&&!u.aboard&&!protectedCargo.has(u.id)&&region.has(u.position.y*view.width+u.position.x)&&distance(u.position,unit.position)<=8);
      // Stationed defenders cannot scout. Select the first mobile army even
      // when a transport exists; fleet presence must not suppress discovery.
      const isScout=unit.kind==='army'&&firstArmy?.id===unit.id;
      if(unit.kind==='army'&&!isScout&&visibleEnemies.length===0&&groundPlan===null&&
         !knownCities.some(c=>distance(c.pos,unit.position)<=1)){
        const ports=view.ownCities.filter(c=>isCoastal(g,c.position))
          .sort((a,b)=>{
            const service=(p:Coord)=>view.ownUnits.some(u=>u.kind==='transport'&&
              view.ownUnits.filter(c=>c.aboard===u.id).length<(capacity(u)??0)&&distance(u.position,p)<=3);
            return Number(service(b.position))-Number(service(a.position))||distance(a.position,unit.position)-distance(b.position,unit.position);
          });
        if(ports.length){
          if(equal(ports[0]!.position,unit.position))break;
          let staged=false;
          for(const port of ports){
            const next=routeStep(g,unit,port.position);
            if(!next)continue;
            try{g=aiMove(g,id,next);staged=true;break;}
            catch{/* Another unit may have moved into this square. */}
          }
          if(staged)continue;
          break;
        }
      }
      // Only choose opponents visible to this faction. Ships/fighters may not
      // attempt a city capture; those targets are exclusively for armies.
      const foes=visibleEnemies.filter(e=>distance(e.position,unit.position)===1);
      const adjacentCities=unit.kind==='army' ? knownCities.filter(c=>distance(c.pos,unit.position)===1) : [];
      const immediate=[...foes.map(e=>e.position),...adjacentCities.map(c=>c.pos)];
      let moved=false;
      for(const target of immediate){
        try {g=aiMove(g,id,target);moved=true;break;}catch{/* Try the next legal contact. */}
      }
      // Stop after any encounter; the AI makes no additional tactical decision
      // with a unit immediately after a battle or city assault.
      if(moved)break;
      if(unit.kind==='army'){
        const planned=groundPlan??(isScout?planAiGroundScoutStep(view,unit):null);
        if(planned){
          try {g=aiMove(g,id,planned);continue;}
          catch {break;} // A newly revealed contact blocks this turn's route.
        }
      }
      const goals=[...visibleEnemies.map(e=>e.position),
        ...((unit.kind==='army'||unit.kind==='transport'&&g.units.some(u=>u.aboard===id))?
          knownCities.map(c=>c.pos):[])].sort((a,b)=>distance(a,unit.position)-distance(b,unit.position));
      const goal=goals[0];
      const possibilities=directions.map(d=>({x:unit.position.x+d.x,y:unit.position.y+d.y}))
        .filter(p=>playable(g,p))
        .sort((a,b)=>goal?distance(a,goal)-distance(b,goal):a.y-b.y||a.x-b.x);
      for(const dest of possibilities){
        const known=view.cells[dest.y*view.width+dest.x];
        if(unit.kind==='transport'&&g.units.some(u=>u.aboard===id)&&known?.city?.owner===faction)
          continue; // Loaded transports should not turn straight back into port.
        if(known&&known.terrain!==null){
          const domain=STATS[unit.kind].domain;
          const isPort=Boolean(known.city);
          if(domain==='land'&&known.terrain==='sea'&&!isPort)continue;
          if(domain==='sea'&&known.terrain==='land'&&!isPort)continue;
        }
        try {g=aiMove(g,id,dest);moved=true;break;}catch{/* An obstacle remains an obstacle. */}
      }
      if(!moved)break;
      // Movement never loops blindly through contacts: the next iteration
      // recomputes the faction's actual, newly updated knowledge.
    }
  }
  // Captures happen after the production pass; activate their factories now.
  for(const city of getPlayerView(g,faction).ownCities)if(city.production===null)g=selectProduction(g,city.id,'army');
  return g;
}

export function playRedOpponent(game:Game):Game {
  if(game.active!=='red')throw new Error('Red AI must act during the red faction turn.');
  return playAiOpponent(game,'red');
}
export function playBlueOpponent(game:Game):Game {
  if(game.active!=='blue')throw new Error('Blue AI requires Blue turn.');
  return playAiOpponent(game,'blue');
}

/** Advance one blue-player round, allowing a rules-bound Red opponent to act. */
export function advanceLabRound(game:Game):Game {
  if(gameOutcome(game).state==='finished')return game;
  if(game.mode!=='rules-lab'||game.active!=='blue')throw new Error('Lab round advance requires blue player.');
  let g=game.scenario==='ai-vs-ai'?playBlueOpponent(game):game;
  g=endTurn(g);
  if((g.scenario==='close-quarters'||g.scenario==='ai-invasion'||g.scenario==='ai-vs-ai'||g.scenario==='user-vs-computer')&&g.active==='red')g=playRedOpponent(g);
  while(g.active!=='blue')g=endTurn(g);
  return g;
}
