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
    log(g,ship.owner,'movement',`${candidate.id} loaded aboard ${ship.id}.`);
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
  log(g,ship.owner,'movement',`${ship.id}: ${cargo.length} embarked units ready for individual landing orders.`);
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
  log(g,army.owner,'movement',`${army.id} boarded ${ship.id} (${aboard.length+1}/${capacity(ship)}).`);
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
  log(g,army.owner,'movement',`${army.id} landed from ${ship.id}.`);
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
  log(g,fighter.owner,'movement',`${fighter.id} landed aboard ${ship.id} and refueled.`);
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
    log(g,fighter.owner,'fuel',`${fighter.id} ran out of fuel after launch.`);
  }else log(g,fighter.owner,'movement',`${fighter.id} launched from ${carrier.id}.`);
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
      log(g,cargo.owner,'movement',`${cargo.id} unloaded in friendly port ${city.id}.`);
    }
  }
  if(unit.order.kind!=='none'&&unit.order.kind!=='skip')unit.order={kind:'none'};
  if(unit.kind==='fighter') {
    unit.fuel=(unit.fuel??MAX_FIGHTER_FUEL)-1;
    if(city?.owner===unit.owner) unit.fuel=MAX_FIGHTER_FUEL; // Timing to be verified.
    else if(unit.fuel<=0){
      g.units=g.units.filter(u=>u.id!==unit.id);
      log(g,unit.owner,'fuel',`${unit.id} ran out of fuel and crashed.`);
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
      if(hostile||(city&&city.owner!==unit.owner)){
        unit.order={kind:'none'};
        log(g,unit.owner,'movement',`${id}: contact requires manual orders.`);
        break;
      }
      try{
        const moved=moveUnit(g,id,step);
        const newUnit=moved.units.find(u=>u.id===id);
        if(newUnit){
          if(nextOrder.kind==='move-to'&&equal(newUnit.position,nextOrder.destination))newUnit.order={kind:'none'};
          else if(nextOrder.kind==='go-home'&&g.cities.some(city=>city.owner===newUnit.owner&&equal(city.position,newUnit.position)))newUnit.order={kind:'none'};
          else newUnit.order=nextOrder;
        }
        g=moved;
      }catch{
        unit.order={kind:'none'};
        log(g,unit.owner,'movement',`${id}: route interrupted; standing order cleared.`);
        break;
      }
    }
  }
  return g;
}
export function runMoveToOrders(game:Game):Game {return executeStandingOrders(clone(game));}
function beginTurn(g:Game):void {
  for(const unit of g.units.filter(u=>u.owner===g.active)){
    unit.spent=0;
    if(unit.kind==='fighter'&&unit.aboard)unit.fuel=MAX_FIGHTER_FUEL;
    if(unit.order.kind==='skip')unit.order={kind:'none'};
    const city=cityAt(g,unit.position);
    if(STATS[unit.kind].domain==='sea'&&unit.damage>0&&city?.owner===g.active&&isCoastal(g,city.position)){
      unit.damage--;
      log(g,g.active,'repair',`${unit.id} repaired one damage point in port.`);
    }
  }
  for(const city of g.cities.filter(c=>c.owner===g.active&&c.production!==null)){
    const kind=city.production!;
    const required=requiredProductionTurns(kind,city.firstCycle,50);
    city.progress++;
    if(city.progress>=required){
      city.progress=0; city.firstCycle=false;
      const unit=newUnit(g,g.active,kind,city.position);
      g.units.push(unit);
      log(g,g.active,'production',`${city.id} completed ${STATS[kind].name} (${unit.id}).`);
    }
  }
  // A ship on Load Ship continues accepting friendly adjacent units at each turn
  // start. It wakes automatically when full.
  for(const ship of g.units.filter(u=>u.owner===g.active&&u.order.kind==='load-ship'))
    fillShip(g,ship);
  updateAllKnowledge(g);
}
/** Settle unused airborne movement as loitering before the owner's turn ends.
 * Exact DOS skipped-move scheduling still requires executable verification.
 */
function settleFighterLoiter(g:Game,unit:Unit):void {
  if(unit.kind!=='fighter'||unit.aboard||cityAt(g,unit.position)?.owner===unit.owner)return;
  const remaining=Math.max(0,movementAllowance(unit)-unit.spent);
  unit.fuel=(unit.fuel??MAX_FIGHTER_FUEL)-remaining;
  unit.spent=movementAllowance(unit);
  if(unit.fuel<=0){g.units=g.units.filter(u=>u.id!==unit.id);log(g,unit.owner,'fuel',`${unit.id} ran out of fuel while airborne and crashed.`);}
}
export function endTurn(game:Game):Game {
  const g=clone(game),currentIndex=g.players.findIndex(p=>p.id===g.active);
  for(const unit of g.units.filter(u=>u.owner===g.active))settleFighterLoiter(g,unit);
  updateAllKnowledge(g);
  if(currentIndex<0)throw new Error('Invalid active player');
  const next=(currentIndex+1)%g.players.length;
  if(next===0)g.round++;
  g.active=g.players[next]!.id;
  beginTurn(g);
  return executeStandingOrders(g);
}
/** Verify that a proposed beachhead has a confirmed land approach to a
 * discovered objective. Distance alone is insufficient when a bay or strait
 * separates the beach from the city. Uses only remembered PlayerView cells.
 */
function aiObjectiveLandRegion(view:ReturnType<typeof getPlayerView>,ids?:ReadonlySet<string>):Set<number> {
  const {width,height,cells}=view,seen=new Set<number>(),queue:number[]=[];
  const faction=view.ownUnits[0]?.owner??view.ownCities[0]?.owner??view.active;
  for(let i=0;i<cells.length;i++)if(cells[i]?.city&&cells[i]!.city!.owner!==faction&&(!ids||ids.has(cells[i]!.city!.id))){seen.add(i);queue.push(i);}
  for(let h=0;h<queue.length;h++)for(const d of directions){
    const x=queue[h]!%width+d.x,y=Math.floor(queue[h]!/width)+d.y,k=y*width+x;
    if(x<=0||y<=0||x>=width-1||y>=height-1||seen.has(k))continue;
    const cell=cells[k];if(cell?.terrain!=='land'||cell.city&&cell.city.owner!==faction)continue;
    seen.add(k);queue.push(k);
  }
  return seen;
}
function aiLandingReachesObjective(view:ReturnType<typeof getPlayerView>,landing:Coord,targetId?:string):boolean {
  const cell=view.cells[landing.y*view.width+landing.x];
  const faction=view.ownUnits[0]?.owner??view.ownCities[0]?.owner??view.active;
  return cell?.terrain==='land'&&cell.city?.owner!==faction&&
    aiObjectiveLandRegion(view,targetId?new Set([targetId]):undefined).has(landing.y*view.width+landing.x);
}

/** Choose a short sea route to a landing area near a *known* non-Red city.
 * Operates exclusively on the Red PlayerView. Unknown terrain may be explored,
 * but no hidden world tile, enemy or city is consulted for route selection.
 * A null result means either no objective or the transport is in landing range.
 */
/** Find the nearest unexplored square reachable by known or plausible water.
 * The route is planned only from faction intelligence, not actual hidden tiles.
 * When an objective is discovered but its coast is unknown or unreachable,
 * exploration must continue rather than freezing the invasion.
 */
export function planAiTransportExploreStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  if(ship.kind!=='transport'||ship.aboard)return null;
  const {cells,width,height}=view,start=ship.position.y*width+ship.position.x;
  const blocked=new Set(view.enemies.filter(e=>!e.stale).map(e=>e.position.y*width+e.position.x));
  for(const u of view.ownUnits)if(!u.aboard&&u.id!==ship.id)blocked.add(u.position.y*width+u.position.x);
  const queue=[start],seen=new Set<number>([start]),parent=new Map<number,number>(),depth=new Map([[start,0]]);
  let best:number|undefined,bestScore=-Infinity;
  for(let head=0;head<queue.length;head++){
    const here=queue[head]!,p={x:here%width,y:Math.floor(here/width)};
    let unknown=0,coast=false;
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y;
      if(x<=0||y<=0||x>=width-1||y>=height-1)continue;
      const cell=cells[y*width+x];
      if(cell?.terrain===null)unknown++;
      if(cell?.terrain==='land')coast=true;
    }
    if(here!==start&&unknown>0){
      // Coastal discovery is useful for finding cities and landing approaches.
      // The weighting is provisional strategy, not an original-DOS rule.
      const score=unknown*(coast?4:1)/(depth.get(here)!+1);
      if(score>bestScore){best=here;bestScore=score;}
    }
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y,k=y*width+x;
      if(x<=0||y<=0||x>=width-1||y>=height-1||seen.has(k)||blocked.has(k)||
         cells[k]?.terrain!=='sea'||cells[k]?.city||aiTransportThreatened(view,{x,y}))continue;
      seen.add(k);parent.set(k,here);depth.set(k,depth.get(here)!+1);queue.push(k);
    }
  }
  if(best===undefined)return null;
  let at=best;
  while(parent.get(at)!==start){const prev=parent.get(at);if(prev===undefined)return null;at=prev;}
  return {x:at%width,y:Math.floor(at/width)};
}

/** A transport carrying armies should not enter a square threatened by
 * a freshly sighted hostile ground unit. Stale reports are not omniscience.
 */
function aiTransportThreatened(view:ReturnType<typeof getPlayerView>,p:Coord):boolean {
  return view.enemies.some(enemy=>!enemy.stale&&enemy.kind==='army'&&
    Math.max(Math.abs(enemy.position.x-p.x),Math.abs(enemy.position.y-p.y))<=1);
}

/** Stable city missions use private remembered intelligence, never hidden ownership. */
export function chooseAiTransportObjective(view:ReturnType<typeof getPlayerView>,ship:Unit):string|undefined {
  if(ship.kind!=='transport'||!view.ownUnits.some(u=>u.aboard===ship.id))return undefined;
  const objectives=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!==ship.owner&&!(ship.aiAvoidObjective?.id===cell.city.id&&ship.aiAvoidObjective.until>view.round)?
    [{id:cell.city.id,owner:cell.city.owner,x:i%view.width,y:Math.floor(i/view.width)}]:[]);
  // Keep a neutral expansion expedition when a larger loaded fleet is already
  // committed to war. Reassign only a distant ship; do not split a landing group.
  const neutral=objectives.filter(c=>c.owner===null);
  const loaded=view.ownUnits.filter(u=>u.kind==='transport'&&view.ownUnits.some(a=>a.kind==='army'&&a.aboard===u.id));
  const neutralCovered=loaded.some(u=>neutral.some(c=>c.id===u.aiObjective));
  const expansionShip=loaded.length>=3&&!neutralCovered&&neutral.length>0?loaded.filter(u=>{
    const target=objectives.find(c=>c.id===u.aiObjective&&c.owner!==null);
    return target&&loaded.filter(partner=>partner.aiObjective===target.id).length>=3&&Math.max(Math.abs(target.x-u.position.x),Math.abs(target.y-u.position.y))>3;
  }).sort((a,b)=>b.id.localeCompare(a.id))[0]:undefined;
  if(expansionShip?.id===ship.id){
    neutral.sort((a,b)=>Math.max(Math.abs(a.x-ship.position.x),Math.abs(a.y-ship.position.y))-
      Math.max(Math.abs(b.x-ship.position.x),Math.abs(b.y-ship.position.y))||a.id.localeCompare(b.id));
    return neutral[0]?.id;
  }
  if(objectives.some(c=>c.id===ship.aiObjective))return ship.aiObjective;
  const assigned=(id:string)=>view.ownUnits.filter(u=>u.kind==='transport'&&u.id!==ship.id&&u.aiObjective===id).length;
  const needed=(city:typeof objectives[number])=>city.owner===null?1:Math.max(2,Math.ceil((3+
    view.enemies.filter(e=>!e.stale&&e.kind==='army'&&Math.max(Math.abs(e.position.x-city.x),Math.abs(e.position.y-city.y))<=3).length)/6));
  objectives.sort((a,b)=>Number(assigned(a.id)>=needed(a))-Number(assigned(b.id)>=needed(b))||Math.max(Math.abs(a.x-ship.position.x),Math.abs(a.y-ship.position.y))-
    Math.max(Math.abs(b.x-ship.position.x),Math.abs(b.y-ship.position.y))||a.id.localeCompare(b.id));
  return objectives[0]?.id;
}

/** Route a loaded convoy to distinct stations around its leading ship. Searches
 * charted sea only; arrival estimates include damage-reduced movement. */
export function planAiConvoyStaging(view:ReturnType<typeof getPlayerView>,ship:Unit):{staging:Coord;next:Coord|null;eta:number;groupEta:number}|null {
  const objective=chooseAiTransportObjective(view,ship);
  const cell=view.cells.findIndex(c=>c.city?.id===objective);
  if(!objective||cell<0||view.cells[cell]!.city!.owner===null)return null;
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const target={x:cell%view.width,y:Math.floor(cell/view.width)};
  const group=view.ownUnits.filter(u=>u.kind==='transport'&&view.ownUnits.some(a=>a.aboard===u.id)&&chooseAiTransportObjective(view,u)===objective)
    .sort((a,b)=>distance(a.position,target)-distance(b.position,target)||a.id.localeCompare(b.id));
  const leader=group[0];if(!leader||group.length<2||!group.some(u=>u.id===ship.id)||(distance(leader.position,target)>6&&planAiLandingSquares(view,leader).length===0))return null;
  if(group.every(u=>distance(u.position,leader.position)<=3))return null;
  const staging=group.find(u=>u.aiAssembly?.objective===objective&&u.aiAssembly.staging)?.aiAssembly?.staging??leader.position;
  const key=(p:Coord)=>p.y*view.width+p.x;
  const stations=[staging,...directions.map(d=>({x:staging.x+d.x,y:staging.y+d.y}))];
  const reserved=new Set<number>();let own:{next:Coord|null;eta:number}|undefined,groupEta=0;
  for(const member of group){
    const blocked=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==member.id).map(u=>key(u.position)));
    for(const e of view.enemies)if(!e.stale)blocked.add(key(e.position));
    const legal=(p:Coord)=>playable(view,p)&&!blocked.has(key(p))&&view.cells[key(p)]?.terrain==='sea'&&!aiTransportThreatened(view,p);
    const queue=[member.position],depth=new Map<number,number>([[key(member.position),0]]),parent=new Map<number,number>();
    for(let h=0;h<queue.length;h++)for(const d of directions){const p={x:queue[h]!.x+d.x,y:queue[h]!.y+d.y},k=key(p);
      if(!legal(p)||depth.has(k))continue;depth.set(k,depth.get(key(queue[h]!))!+1);parent.set(k,key(queue[h]!));queue.push(p);
    }
    const station=stations.filter(p=>!reserved.has(key(p))&&(equal(p,member.position)||legal(p))&&depth.has(key(p)))
      .sort((a,b)=>depth.get(key(a))!-depth.get(key(b))!||a.y-b.y||a.x-b.x)[0];
    if(!station)return null;reserved.add(key(station));
    const steps=depth.get(key(station))!,speed=movementAllowance(member),remaining=Math.max(0,speed-member.spent);
    const eta=steps===0?0:1+Math.ceil(Math.max(0,steps-remaining)/speed);groupEta=Math.max(groupEta,eta);
    let next:Coord|null=null;
    if(steps){let k=key(station);while(parent.get(k)!==key(member.position)){const previous=parent.get(k);if(previous===undefined)return null;k=previous;}next={x:k%view.width,y:Math.floor(k/view.width)};}
    if(member.id===ship.id)own={next,eta};
  }
  return own?{staging:{...staging},...own,groupEta}:null;
}

/** Bounded recruitment/rendezvous wait for a real multi-transport hostile force.
 * Remember the first wait per objective so an impossible rendezvous cannot reset
 * its timer forever. Neutral missions and isolated transports continue normally. */
export function planAiTransportAssembly(view:ReturnType<typeof getPlayerView>,ship:Unit):{ship:Unit;wait:boolean} {
  const next=structuredClone(ship),objective=chooseAiTransportObjective(view,ship);
  if(next.aiAssembly?.objective!==objective)delete next.aiAssembly;
  const cell=view.cells.findIndex(c=>c.city?.id===objective);
  if(!objective||cell<0||view.cells[cell]!.city!.owner===null)return {ship:next,wait:false};
  const target={x:cell%view.width,y:Math.floor(cell/view.width)};
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const cargo=(id:string)=>view.ownUnits.filter(u=>u.kind==='army'&&u.aboard===id).length;
  const supplied=(u:Unit)=>view.ownCities.some(c=>c.production==='army'&&distance(c.position,u.position)<=1);
  // An empty hull at a nearby supply port is a real recruitment partner, even
  // before cargo gives it a city mission. Require a short charted sea connection.
  const nearbySupplyPartner=(u:Unit)=>{
    if(distance(u.position,ship.position)>3||!supplied(u))return false;
    const queue=[ship.position],seen=new Set([ship.position.y*view.width+ship.position.x]);
    for(let h=0;h<queue.length;h++){
      const p=queue[h]!;if(equal(p,u.position))return true;
      for(const d of directions){const q={x:p.x+d.x,y:p.y+d.y},k=q.y*view.width+q.x,cell=view.cells[k];
        if(!playable(view,q)||distance(q,ship.position)>3||seen.has(k)||
          cell?.city&&cell.city.owner!==ship.owner||cell?.terrain!=='sea'&&!cell?.city||aiTransportThreatened(view,q))continue;
        seen.add(k);queue.push(q);
      }
    }
    return false;
  };
  const partners=view.ownUnits.filter(u=>u.kind==='transport'&&u.id!==ship.id&&
    (cargo(u.id)>0?chooseAiTransportObjective(view,u)===objective:
      (!u.aiObjective||u.aiObjective===objective)&&nearbySupplyPartner(u)));
  if(ship.kind!=='transport'||!cargo(ship.id)||!partners.length||aiTransportThreatened(view,ship.position))return {ship:next,wait:false};
  const recruiting=cargo(ship.id)<(capacity(ship)??0)&&supplied(ship)||
    partners.some(u=>cargo(u.id)<(capacity(u)??0)&&nearbySupplyPartner(u));
  if(next.aiAssembly?.gathered)return {ship:next,wait:false};
  const staging=planAiConvoyStaging(view,ship);
  const rendezvous=staging!==null;
  if(!recruiting&&!rendezvous){
    if(next.aiAssembly?.staging&&partners.every(u=>distance(u.position,ship.position)<=3))next.aiAssembly.gathered=true;
    return {ship:next,wait:false};
  }
  if(!next.aiAssembly)next.aiAssembly={objective,startedRound:view.round};
  if(staging)next.aiAssembly.staging=staging.staging;
  return {ship:next,wait:view.round-next.aiAssembly.startedRound<12&&(!staging||staging.groupEta<=12-(view.round-next.aiAssembly.startedRound))};
}

/** Experimental timeout: 24 rounds without shortening the delivery route or
 * unloading. Rebase when discovery/blockage changes which metric is available.
 * Retry a stalled objective after 12 rounds; never consult hidden ownership.
 */
export function updateAiTransportMission(view:ReturnType<typeof getPlayerView>,ship:Unit):Unit {
  const next=structuredClone(ship);
  if(next.aiAvoidObjective&&next.aiAvoidObjective.until<=view.round)delete next.aiAvoidObjective;
  let objective=chooseAiTransportObjective(view,next);
  const cargo=view.ownUnits.filter(u=>u.aboard===ship.id).length;
  const measure=(id:string)=>{
    const route=aiInvasionRoute(view,{...next,aiObjective:id});
    const i=view.cells.findIndex(c=>c.city?.id===id);
    return {metric:route?'sea' as const:'city' as const,distance:route?.distance??
      Math.max(Math.abs(i%view.width-ship.position.x),Math.abs(Math.floor(i/view.width)-ship.position.y))};
  };
  let measured=objective?measure(objective):undefined;
  if(objective&&objective===ship.aiObjective&&next.aiMissionProgress&&measured){
    const progress=next.aiMissionProgress;
    if(measured.metric!==progress.metric||measured.distance<progress.bestDistance||cargo<progress.cargo)
      next.aiMissionProgress={round:view.round,bestDistance:measured.distance,metric:measured.metric,cargo};
    else if(view.round-progress.round>=24){
      next.aiAvoidObjective={id:objective,until:view.round+12};
      delete next.aiObjective;delete next.aiMissionProgress;
      objective=chooseAiTransportObjective(view,next);
      measured=objective?measure(objective):undefined;
    }
  }
  if(objective&&measured){
    if(objective!==next.aiObjective||!next.aiMissionProgress)
      next.aiMissionProgress={round:view.round,bestDistance:measured.distance,metric:measured.metric,cargo};
    next.aiObjective=objective;
  }else {delete next.aiObjective;delete next.aiMissionProgress;}
  return next;
}

/** Navigation and unloading must agree on which charted beaches are usable.
 * Cities require a later ground assault; occupied cells cannot receive cargo.
 */
function aiBeachAvailable(view:ReturnType<typeof getPlayerView>,p:Coord):boolean {
  const cell=view.cells[p.y*view.width+p.x];
  return cell?.terrain==='land'&&!cell.city&&!aiTransportThreatened(view,p)&&
    !view.enemies.some(e=>!e.stale&&equal(e.position,p))&&
    !view.ownUnits.some(u=>!u.aboard&&equal(u.position,p));
}

function aiInvasionRoute(view:ReturnType<typeof getPlayerView>,ship:Unit):{next:Coord|null;distance:number}|null {
  const objectives=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!==ship.owner&&!(ship.aiAvoidObjective?.id===cell.city.id&&ship.aiAvoidObjective.until>view.round)&&(!ship.aiObjective||cell.city.id===ship.aiObjective)?
    [{id:cell.city.id,x:i%view.width,y:Math.floor(i/view.width)}]:[]);
  const cells=view.cells;
  if(!objectives.length)return null;
  const destinations=new Set<number>();
  // Reverse known-land connectivity once, then find every usable coastline
  // leading to the objective, including shores far from an inland city.
  const region=aiObjectiveLandRegion(view,new Set(objectives.map(c=>c.id)));
  for(const k of region){
      const x=k%view.width,y=Math.floor(k/view.width),landing={x,y};
      if(!aiBeachAvailable(view,landing))continue;
      for(const d of directions){
        const sea={x:x+d.x,y:y+d.y};
        if(sea.x<=0||sea.y<=0||sea.x>=view.width-1||sea.y>=view.height-1)continue;
        const i=sea.y*view.width+sea.x;
        if((cells[i]?.terrain==='sea'||cells[i]?.terrain===null)&&
           !aiTransportThreatened(view,sea))destinations.add(i);
      }
    }
  if(!destinations.size)return null;
  const start=ship.position.y*view.width+ship.position.x;
  if(destinations.has(start)&&!aiTransportThreatened(view,ship.position))return {next:null,distance:0};
  const blocked=new Set(view.enemies.filter(e=>!e.stale).map(e=>e.position.y*view.width+e.position.x));
  for(const u of view.ownUnits)if(!u.aboard&&u.id!==ship.id)
    blocked.add(u.position.y*view.width+u.position.x);
  const seen=new Set<number>([start]),queue=[start],parent=new Map<number,number>();
  let found:number|undefined;
  for(let head=0;head<queue.length;head++){
    const current=queue[head]!;
    if(destinations.has(current)){found=current;break;}
    const p={x:current%view.width,y:Math.floor(current/view.width)};
    for(const direction of directions){
      const next={x:p.x+direction.x,y:p.y+direction.y};
      if(next.x<=0||next.y<=0||next.x>=view.width-1||next.y>=view.height-1)continue;
      const i=next.y*view.width+next.x;
      if(seen.has(i)||blocked.has(i)||cells[i]?.terrain==='land'||cells[i]?.city||
         aiTransportThreatened(view,next))continue;
      seen.add(i);parent.set(i,current);queue.push(i);
    }
  }
  if(found===undefined)return null;
  let at=found,distance=1;
  while(parent.get(at)!==start){
    const previous=parent.get(at);
    if(previous===undefined)return null;
    at=previous;distance++;
  }
  return {next:{x:at%view.width,y:Math.floor(at/view.width)},distance};
}

/** Use the same safe beach/sea search for movement and mission progress. */
export function planAiInvasionStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  const route=aiInvasionRoute(view,ship);
  return route?route.next:planAiTransportExploreStep(view,ship);
}

/** Explore the nearest unknown frontier reachable over charted land.
 * Unknown squares are goals, not transit corridors; the actual move still
 * goes through moveUnit, so fog never grants terrain knowledge.
 */
/** Rank currently charted beachheads without consulting hidden terrain or
 * hidden enemy positions. An exposed landing is worse than waiting offshore.
 * Fresh army contacts threaten adjacent squares; stale sightings are only
 * advisory and cannot permanently prohibit a beachhead.
 */
export function planAiLandingSquares(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord[] {
  const cheb=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const objectives:Coord[]=[];
  for(let i=0;i<view.cells.length;i++){
    const city=view.cells[i]?.city;
    if(city&&city.owner!=='red'&&!(ship.aiAvoidObjective?.id===city.id&&ship.aiAvoidObjective.until>view.round)&&(!ship.aiObjective||city.id===ship.aiObjective))
      objectives.push({x:i%view.width,y:Math.floor(i/view.width)});
  }
  if(!objectives.length)return [];
  const options:Coord[]=[];
  for(const d of directions){
    const p={x:ship.position.x+d.x,y:ship.position.y+d.y};
    if(p.x<=0||p.y<=0||p.x>=view.width-1||p.y>=view.height-1)continue;
    if(!aiBeachAvailable(view,p)||!aiLandingReachesObjective(view,p,ship.aiObjective))continue;
    options.push(p);
  }
  return options.sort((a,b)=>{
    const objectiveDistance=(p:Coord)=>Math.min(...objectives.map(o=>cheb(p,o)));
    const stalePenalty=(p:Coord)=>view.enemies.filter(e=>e.stale&&e.kind==='army'&&
      cheb(e.position,p)<=1).length;
    return stalePenalty(a)-stalePenalty(b)||
      objectiveDistance(a)-objectiveDistance(b)||a.y-b.y||a.x-b.x;
  });
}

/** Coordinate the available expedition, without a fixed fleet prerequisite.
 * Prefer two armies at a neutral city, three at a hostile one. A smaller
 * isolated expedition may still land; spent cargo and nearby mission partners
 * count as available strength, but cannot contribute until ready. Wave size
 * is capped by usable beaches so a narrow coast cannot deadlock an expedition.
 */
export function planAiLandingWave(view:ReturnType<typeof getPlayerView>):{armyId:string;position:Coord}[] {
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const result:{armyId:string;position:Coord}[]=[],assigned=new Set<string>();
  const ships=view.ownUnits.filter(u=>u.kind==='transport'&&!u.aboard)
    .sort((a,b)=>a.id.localeCompare(b.id));
  for(const anchor of ships){
    if(assigned.has(anchor.id))continue;
    const target=chooseAiTransportObjective(view,anchor);
    if(!target||!planAiLandingSquares(view,anchor).length)continue;
    const targetIndex=view.cells.findIndex(c=>c.city?.id===target);
    const city=view.cells[targetIndex]!.city!,objective={x:targetIndex%view.width,y:Math.floor(targetIndex/view.width)};
    const group=ships.filter(s=>!assigned.has(s.id)&&distance(s.position,anchor.position)<=3&&
      chooseAiTransportObjective(view,s)===target);
    for(const ship of group)assigned.add(ship.id);
    const ids=new Set(group.map(s=>s.id));
    const cargo=view.ownUnits.filter(u=>u.kind==='army'&&u.aboard&&ids.has(u.aboard));
    const support=view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&u.order.kind!=='sentry'&&
      distance(u.position,objective)<=2&&aiLandingReachesObjective(view,u.position,target)).length;
    const needed=Math.max(0,Math.min(city.owner===null?2:Math.max(3,group.length*6),cargo.length+support)-support);
    const choices=new Map(group.map(s=>[s.id,planAiLandingSquares(view,{...s,aiObjective:target})
      .filter(p=>!result.some(r=>equal(r.position,p)))]));
    // Bipartite matching: a flexible ship must not consume another ship's only
    // beach. Each ready army gets one distinct legal square before any unload.
    const slots=new Map<number,{armyId:string;position:Coord}>();
    const ready=cargo.filter(u=>u.spent<movementAllowance(u)).sort((a,b)=>a.id.localeCompare(b.id));
    const byId=new Map(cargo.map(u=>[u.id,u]));
    const place=(army:Unit,seen:Set<number>):boolean=>{
      for(const position of choices.get(army.aboard!)??[]){
        const key=position.y*view.width+position.x;
        if(seen.has(key))continue;
        seen.add(key);
        const previous=slots.get(key);
        if(!previous||place(byId.get(previous.armyId)!,seen)){
          slots.set(key,{armyId:army.id,position});return true;
        }
      }
      return false;
    };
    for(const army of cargo)place(army,new Set());
    const possible=slots.size;slots.clear();
    for(const army of ready)place(army,new Set());
    if(slots.size>=Math.min(needed,possible))result.push(...slots.values());
  }
  return result;
}

/** Intercept freshly detected transports using only charted navigable cells.
 * A shortest-route search prefers reachable contacts over geometric proximity.
 * Stale reports are not live targets; delivery/basing hulls are not hunters.
 */
export function planAiNavalTransportIntercept(view:ReturnType<typeof getPlayerView>,ship:Unit,investigateStale=false):Coord|null {
  if(!['destroyer','submarine','cruiser','battleship'].includes(ship.kind)||ship.aboard||ship.order.kind==='sentry')return null;
  const key=(p:Coord)=>p.y*view.width+p.x;
  const targets=new Set(view.enemies.filter(e=>(investigateStale?e.stale:!e.stale)&&e.kind==='transport').map(e=>key(e.position)));
  if(!targets.size)return null;
  const blocked=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==ship.id&&
    view.cells[key(u.position)]?.city?.owner!==ship.owner).map(u=>key(u.position)));
  for(const enemy of view.enemies)if(!enemy.stale&&!targets.has(key(enemy.position)))blocked.add(key(enemy.position));
  const start=key(ship.position),queue=[start],seen=new Set([start]),parent=new Map<number,number>();
  let found:number|undefined;
  for(let h=0;h<queue.length;h++){
    const at=queue[h]!;
    if(investigateStale?[...targets].some(k=>Math.max(Math.abs(k%view.width-at%view.width),Math.abs(Math.floor(k/view.width)-Math.floor(at/view.width)))<=1):at!==start&&targets.has(at)){found=at;break;}
    for(const d of directions){
      const p={x:at%view.width+d.x,y:Math.floor(at/view.width)+d.y},k=key(p),cell=view.cells[k];
      if(!playable(view,p)||seen.has(k)||blocked.has(k)||
        cell?.city&&cell.city.owner!==ship.owner||cell?.terrain!=='sea'&&!cell?.city)continue;
      seen.add(k);parent.set(k,at);queue.push(k);
    }
  }
  if(found===undefined||found===start)return null;
  let next=found;while(parent.get(next)!==start){const previous=parent.get(next);if(previous===undefined)return null;next=previous;}
  return {x:next%view.width,y:Math.floor(next/view.width)};
}

/** Idle combat ships cover charted coastlines, spreading out from other
 * warships and staying off friendly port entrances. Recomputed each turn:
 * this is an AI duty, not a permanent player Sentry order.
 */
export function planAiCoastalSentryStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  const combatShip=(u:Unit)=>['destroyer','submarine','cruiser','battleship'].includes(u.kind)&&!u.aboard;
  if(!combatShip(ship)||ship.order.kind==='sentry')return null;
  const key=(p:Coord)=>p.y*view.width+p.x,distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const blocked=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==ship.id&&
    view.cells[key(u.position)]?.city?.owner!==ship.owner).map(u=>key(u.position)));
  for(const e of view.enemies)if(!e.stale)blocked.add(key(e.position));
  const peers=view.ownUnits.filter(u=>u.id!==ship.id&&combatShip(u));
  // Secure the perimeter of a friendly landmass rather than occupying any
  // convenient coast. Unknown interiors remain unknown; this is an assessment
  // of charted connected land and remembered/fresh faction intelligence only.
  const eligibleLand=new Set<number>(),seenLand=new Set<number>();
  const enemyLand=new Set(view.enemies.filter(e=>!e.stale).map(e=>key(e.position)));
  for(let i=0;i<view.cells.length;i++){
    if(seenLand.has(i)||view.cells[i]?.terrain!=='land')continue;
    const region=[i];seenLand.add(i);let friendly=false,hostile=false;
    for(let h=0;h<region.length;h++){
      const at=region[h]!,city=view.cells[at]?.city;
      if(city?.owner===ship.owner)friendly=true;
      if(city&&city.owner!==null&&city.owner!==ship.owner||enemyLand.has(at))hostile=true;
      for(const d of directions){
        const q={x:at%view.width+d.x,y:Math.floor(at/view.width)+d.y},k=key(q);
        if(!playable(view,q)||seenLand.has(k)||view.cells[k]?.terrain!=='land')continue;
        seenLand.add(k);region.push(k);
      }
    }
    if(friendly&&!hostile)for(const k of region)eligibleLand.add(k);
  }
  if(!eligibleLand.size)return null;
  const queue=[ship.position],depth=new Map([[key(ship.position),0]]),parent=new Map<number,number>();
  let best:Coord|undefined,bestScore=0,bestDepth=Infinity;
  for(let h=0;h<queue.length;h++){
    const p=queue[h]!,at=key(p),cell=view.cells[at];
    const neighbors=directions.map(d=>({x:p.x+d.x,y:p.y+d.y})).filter(q=>playable(view,q));
    const coast=neighbors.some(q=>eligibleLand.has(key(q)));
    if(cell?.terrain==='sea'&&!cell.city&&coast&&
      !view.ownCities.some(c=>distance(c.position,p)<=1)&&
      neighbors.filter(q=>view.cells[key(q)]?.terrain==='sea').length>=3){
      const nearHome=view.ownCities.some(c=>distance(c.position,p)<=4);
      const covered=peers.some(u=>distance(u.position,p)<=3);
      const score=(nearHome?30:10)-(covered?30:0),steps=depth.get(at)!;
      if(score>bestScore||score===bestScore&&score>0&&steps<bestDepth){best=p;bestScore=score;bestDepth=steps;}
    }
    for(const q of neighbors){
      const k=key(q),next=view.cells[k];
      if(depth.has(k)||blocked.has(k)||next?.city&&next.city.owner!==ship.owner||next?.terrain!=='sea'&&!next?.city)continue;
      depth.set(k,depth.get(at)!+1);parent.set(k,at);queue.push(q);
    }
  }
  if(!best||equal(best,ship.position))return null;
  let next=key(best);while(parent.get(next)!==key(ship.position)){const previous=parent.get(next);if(previous===undefined)return null;next=previous;}
  return {x:next%view.width,y:Math.floor(next/view.width)};
}

/** Empty transports rendezvous with mobile troops already on charted beaches.
 * Compare sea travel per available load; never route through hidden terrain.
 */
export function planAiBeachPickup(view:ReturnType<typeof getPlayerView>,ship:Unit,excluded:ReadonlySet<string>=new Set()):{next:Coord|null;armies:string[];armySteps:Record<string,Coord>}|null {
  const free=(capacity(ship)??0)-view.ownUnits.filter(u=>u.aboard===ship.id).length;
  if(ship.kind!=='transport'||free<=0||view.ownUnits.some(u=>u.aboard===ship.id)&&!ship.aiPickup||ship.aiPickup&&view.round-ship.aiPickup.startedRound>=12||aiTransportThreatened(view,ship.position))return null;
  const key=(p:Coord)=>p.y*view.width+p.x,beaches=new Map<number,{army:Unit;next:Coord|null;walk:number}[]>();
  for(const army of view.ownUnits){
    const cell=view.cells[key(army.position)];
    if(army.kind!=='army'||army.aboard||ship.aiPickup&&!ship.aiPickup.armies.includes(army.id)||excluded.has(army.id)||army.order.kind==='sentry'||
      cell?.terrain!=='land'||aiTransportThreatened(view,army.position)||planAiGroundStep(view,army))continue;
    const region=aiGroundRegion(view,army.position);
    const objectiveNearby=view.cells.some((c,i)=>c.city&&c.city.owner!==ship.owner&&directions.some(d=>region.has((Math.floor(i/view.width)+d.y)*view.width+i%view.width+d.x)));
    if(objectiveNearby)continue;
    const scout=view.ownUnits.find(u=>u.kind==='army'&&!u.aboard&&!excluded.has(u.id)&&u.order.kind!=='sentry'&&region.has(key(u.position)));
    if(scout?.id===army.id&&planAiGroundScoutStep(view,army))continue;
    const occupied=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==army.id&&!view.cells[key(u.position)]?.city).map(u=>key(u.position)));
    const start=key(army.position),queue=[start],depth=new Map([[start,0]]),parent=new Map<number,number>();
    for(let h=0;h<queue.length;h++){
      const at=queue[h]!,p={x:at%view.width,y:Math.floor(at/view.width)},cell=view.cells[at];
      if(!cell?.city&&directions.some(d=>view.cells[key({x:p.x+d.x,y:p.y+d.y})]?.terrain==='sea')&&!aiTransportThreatened(view,p)){
        let step=at;while(parent.has(step)&&parent.get(step)!==start)step=parent.get(step)!;
        const entry={army,next:at===start?null:{x:step%view.width,y:Math.floor(step/view.width)},walk:depth.get(at)!};
        beaches.set(at,[...(beaches.get(at)??[]),entry]);
      }
      if(depth.get(at)!>=8)continue;
      for(const d of directions){const q={x:p.x+d.x,y:p.y+d.y},k=key(q),c=view.cells[k];
        if(!playable(view,q)||depth.has(k)||occupied.has(k)||c?.terrain!=='land'||c.city&&c.city.owner!==ship.owner||aiTransportThreatened(view,q))continue;
        depth.set(k,depth.get(at)!+1);parent.set(k,at);queue.push(k);
      }
    }
  }
  if(!beaches.size)return null;
  const blocked=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==ship.id&&view.cells[key(u.position)]?.city?.owner!==ship.owner).map(u=>key(u.position)));
  for(const e of view.enemies)if(!e.stale)blocked.add(key(e.position));
  const start=key(ship.position),queue=[start],depth=new Map([[start,0]]),parent=new Map<number,number>();
  let best:number|undefined,armies:string[]=[],armySteps:Record<string,Coord>={},score=Infinity;
  for(let h=0;h<queue.length;h++){
    const at=queue[h]!,p={x:at%view.width,y:Math.floor(at/view.width)};
    const options=directions.flatMap(d=>beaches.get(key({x:p.x+d.x,y:p.y+d.y}))??[]).sort((a,b)=>a.walk-b.walk||a.army.id.localeCompare(b.army.id));
    const group=[...new Map(options.map(a=>[a.army.id,options.find(b=>b.army.id===a.army.id)!])).values()];
    // A single mobile army may be the landmass's only scout or assault survivor.
    if(group.length>=(ship.aiPickup?1:2)){const available=group.slice(0,free),cost=(Math.max(depth.get(at)!/Math.max(1,movementAllowance(ship)),...available.map(a=>a.walk))+1)/available.length;
      if(cost<score){score=cost;best=at;armies=available.map(u=>u.army.id);armySteps=Object.fromEntries(available.filter(a=>a.next).map(a=>[a.army.id,a.next!]));}}
    for(const d of directions){
      const q={x:p.x+d.x,y:p.y+d.y},k=key(q);
      const cell=view.cells[k];
      if(!playable(view,q)||depth.has(k)||blocked.has(k)||aiTransportThreatened(view,q)||
        cell?.city&&cell.city.owner!==ship.owner||cell?.terrain!=='sea'&&!cell?.city)continue;
      depth.set(k,depth.get(at)!+1);parent.set(k,at);queue.push(k);
    }
  }
  if(best===undefined)return null;
  for(const port of ship.aiPickup?[]:view.ownCities){
    if(!directions.some(d=>view.cells[(port.position.y+d.y)*view.width+port.position.x+d.x]?.terrain==='sea'))continue;
    const region=aiGroundRegion(view,port.position);
    const supply=view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&!excluded.has(u.id)&&u.order.kind!=='sentry'&&
      Math.max(Math.abs(u.position.x-port.position.x),Math.abs(u.position.y-port.position.y))<=3&&region.has(key(u.position))).length;
    const cost=(Math.max(Math.abs(ship.position.x-port.position.x),Math.abs(ship.position.y-port.position.y))+1)/Math.min(capacity(ship)!,supply);
    if(supply&&cost<score)return null;
  }
  if(best===start)return {next:null,armies,armySteps};
  let at=best;while(parent.get(at)!==start){const previous=parent.get(at);if(previous===undefined)return null;at=previous;}
  return {next:{x:at%view.width,y:Math.floor(at/view.width)},armies,armySteps};
}

/** Naval reconnaissance: choose a reachable sea frontier by information gained
 * per travel step. Route only through charted sea; unknown cells are endpoints,
 * never presumed safe transit. No world state outside PlayerView is consulted.
 */
export function planAiNavalScoutStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  if(ship.kind!=='destroyer'||ship.aboard)return null;
  const {width,height,cells}=view,start=ship.position.y*width+ship.position.x;
  const occupied=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==ship.id)
    .map(u=>u.position.y*width+u.position.x));
  for(const e of view.enemies)if(!e.stale)occupied.add(e.position.y*width+e.position.x);
  const queue=[start],seen=new Set<number>([start]),parent=new Map<number,number>();
  const depth=new Map<number,number>([[start,0]]);
  let best:number|undefined,bestScore=-Infinity;
  for(let head=0;head<queue.length;head++){
    const here=queue[head]!,p={x:here%width,y:Math.floor(here/width)};
    const steps=depth.get(here)!;
    let unknown=0;
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y;
      if(x<=0||y<=0||x>=width-1||y>=height-1)continue;
      if(cells[y*width+x]?.terrain===null)unknown++;
    }
    if(here!==start&&unknown>0){
      const score=unknown/(steps+1);
      if(score>bestScore){best=here;bestScore=score;}
    }
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y,k=y*width+x;
      if(x<=0||y<=0||x>=width-1||y>=height-1||seen.has(k)||
         occupied.has(k)||cells[k]?.terrain!=='sea'||cells[k]?.city)continue;
      seen.add(k);parent.set(k,here);depth.set(k,steps+1);queue.push(k);
    }
  }
  if(best===undefined)return null;
  let at=best;
  while(parent.get(at)!==start){
    const prev=parent.get(at);
    if(prev===undefined)return null;
    at=prev;
  }
  return {x:at%width,y:Math.floor(at/width)};
}

export function planAiGroundScoutStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  if(ship.kind!=='army'||ship.aboard)return null;
  const {width,height,cells}=view,start=ship.position.y*width+ship.position.x;
  const occupied=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==ship.id)
    .map(u=>u.position.y*width+u.position.x));
  for(const e of view.enemies)if(!e.stale)occupied.add(e.position.y*width+e.position.x);
  const queue=[start],seen=new Set<number>([start]),parent=new Map<number,number>();
  const depth=new Map<number,number>([[start,0]]);
  let best:number|undefined,bestScore=-Infinity;
  for(let head=0;head<queue.length;head++){
    const here=queue[head]!,p={x:here%width,y:Math.floor(here/width)};
    const steps=depth.get(here)!;
    let unknown=0;
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y;
      if(x<=0||y<=0||x>=width-1||y>=height-1)continue;
      if(cells[y*width+x]?.terrain===null)unknown++;
    }
    if(here!==start&&unknown>0){
      const score=unknown/(steps+1);
      if(score>bestScore){best=here;bestScore=score;}
    }
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y,k=y*width+x;
      if(x<=0||y<=0||x>=width-1||y>=height-1||seen.has(k)||
         occupied.has(k)||cells[k]?.terrain!=='land'||(cells[k]?.city&&cells[k]?.city?.owner!==view.active))continue;
      seen.add(k);parent.set(k,here);depth.set(k,steps+1);queue.push(k);
    }
  }
  if(best===undefined)return null;
  let at=best;
  while(parent.get(at)!==start){
    const prev=parent.get(at);
    if(prev===undefined)return null;
    at=prev;
  }
  return {x:at%width,y:Math.floor(at/width)};
}

/** Plan one land move toward a discovered non-friendly city, routing around
 * known water and occupied squares. This function deliberately accepts only a
 * PlayerView: it cannot read hidden map tiles or live enemy positions.
 * The final city assault remains an ordinary, separate moveUnit action.
 */
export function planAiGroundStep(view:ReturnType<typeof getPlayerView>,army:Unit):Coord|null {
  if(army.kind!=='army'||army.aboard)return null;
  const width=view.width,height=view.height;
  const key=(p:Coord)=>p.y*width+p.x;
  const start=key(army.position);
  const targets:Coord[]=[];
  for(let i=0;i<view.cells.length;i++){
    const cell=view.cells[i];
    if(cell?.city&&cell.city.owner!==view.active)
      targets.push({x:i%width,y:Math.floor(i/width)});
  }
  if(!targets.length)return null;
  const cheb=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  if(targets.some(p=>cheb(p,army.position)<=1))return null;
  const occupied=new Set<number>();
  for(const u of view.ownUnits)if(!u.aboard&&u.id!==army.id)occupied.add(key(u.position));
  for(const enemy of view.enemies)if(!enemy.stale)occupied.add(key(enemy.position));
  const queue=[start],seen=new Set<number>([start]),parent=new Map<number,number>();
  let found:number|undefined;
  for(let head=0;head<queue.length;head++){
    const here=queue[head]!;
    const p={x:here%width,y:Math.floor(here/width)};
    if(targets.some(target=>cheb(target,p)===1)){found=here;break;}
    for(const d of directions){
      const next={x:p.x+d.x,y:p.y+d.y};
      if(next.x<=0||next.y<=0||next.x>=width-1||next.y>=height-1)continue;
      const k=key(next),cell=view.cells[k];
      // Armies require a *confirmed* land route. Treat unexplored cells as
      // unknown, not a magical bridge across an undiscovered ocean.
      if(seen.has(k)||occupied.has(k)||cell?.terrain!=='land')continue;
      // A city owned by another faction must be assaulted, not routed through.
      if(cell?.city&&cell.city.owner!==view.active)continue;
      seen.add(k);parent.set(k,here);queue.push(k);
    }
  }
  if(found===undefined)return null;
  let cursor=found;
  while(parent.get(cursor)!==start){
    const previous=parent.get(cursor);
    if(previous===undefined)return null;
    cursor=previous;
  }
  return {x:cursor%width,y:Math.floor(cursor/width)};
}

/**
 * Close Quarters' preliminary computer opponent. It sees only its own PlayerView,
 * chooses known targets, and executes the very same moves as the human player.
 * This is NOT an attempt to reproduce the original game's AI strategy.
 * The older classic-lab fixture remains passive for reproducible system tests.
 */
/** Local reserve accounting uses charted land connectivity, never hidden terrain.
 * Occupancy does not split a strategic supply region; hostile cities do.
 */
function aiGroundRegion(view:ReturnType<typeof getPlayerView>,origin:Coord):Set<number> {
  const key=(p:Coord)=>p.y*view.width+p.x;
  const seen=new Set<number>([key(origin)]),queue=[origin];
  for(let head=0;head<queue.length;head++)for(const d of directions){
    const p={x:queue[head]!.x+d.x,y:queue[head]!.y+d.y};
    if(p.x<=0||p.y<=0||p.x>=view.width-1||p.y>=view.height-1)continue;
    const k=key(p),cell=view.cells[k];
    if(seen.has(k)||cell?.terrain!=='land'||cell.city&&cell.city.owner!==view.active)continue;
    seen.add(k);queue.push(p);
  }
  return seen;
}
export function aiLocalArmyReserve(view:ReturnType<typeof getPlayerView>,origin:Coord):number {
  const seen=aiGroundRegion(view,origin);
  return view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&seen.has(u.position.y*view.width+u.position.x)).length;
}

/** Opportunistic reconnaissance: land one scout on an unoccupied charted land
 * region with an unknown frontier. Space drop sites away from nearby supply
 * and scouts already ashore. No undiscovered city is used as a target.
 */
export function planAiReconLandingSquare(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  if(ship.kind!=='transport')return null;
  const cargo=view.ownUnits.filter(u=>u.kind==='army'&&u.aboard===ship.id).length;
  if(ship.aiObjective&&cargo<4)return null; // Keep three armies for the city assault.
  for(const d of directions){
    const p={x:ship.position.x+d.x,y:ship.position.y+d.y};
    if(p.x<=0||p.y<=0||p.x>=view.width-1||p.y>=view.height-1||!aiBeachAvailable(view,p))continue;
    if(ship.aiObjective){
      const target=view.cells.findIndex(c=>c.city?.id===ship.aiObjective);
      if(target<0||Math.max(Math.abs(target%view.width-p.x),Math.abs(Math.floor(target/view.width)-p.y))<=8)continue;
    }
    const region=aiGroundRegion(view,p),key=(q:Coord)=>q.y*view.width+q.x;
    const nearby=(q:Coord)=>region.has(key(q))&&Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y))<=8;
    if(view.ownCities.some(c=>nearby(c.position))||
       view.ownUnits.some(u=>u.kind==='army'&&!u.aboard&&nearby(u.position)))continue;
    if([...region].some(k=>directions.some(d=>{
      const q={x:k%view.width+d.x,y:Math.floor(k/view.width)+d.y};
      return playable(view,q)&&view.cells[key(q)]?.terrain===null;
    })))return p;
  }
  return null;
}

/** Fuel-safe aerial reconnaissance over faction-known obstacles. Return distances
 * are actual air routes to owned cities/carriers, not hidden-map estimates. */
export function planAiFighterStep(view:ReturnType<typeof getPlayerView>,fighter:Unit):Coord|null {
  if(fighter.kind!=='fighter')return null;
  const key=(p:Coord)=>p.y*view.width+p.x;
  const bases=[...view.ownCities.map(c=>c.position),...view.ownUnits.filter(u=>u.kind==='carrier'&&(fighter.aboard===u.id||
    view.ownUnits.filter(c=>c.aboard===u.id).length<(capacity(u)??0))).map(u=>u.position)];
  if(!bases.length)return null;
  const baseKeys=new Set(bases.map(key));
  const blocked=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==fighter.id&&!baseKeys.has(key(u.position))).map(u=>key(u.position)));
  for(const enemy of view.enemies)if(!enemy.stale)blocked.add(key(enemy.position));
  const legal=(p:Coord)=>playable(view,p)&&!blocked.has(key(p))&&
    (!view.cells[key(p)]?.city||view.cells[key(p)]!.city!.owner===fighter.owner);
  const returns=new Map<number,number>(),queue:Coord[]=[];
  for(const p of bases){returns.set(key(p),0);queue.push(p);}
  for(let h=0;h<queue.length;h++)for(const d of directions){
    const p={x:queue[h]!.x+d.x,y:queue[h]!.y+d.y},k=key(p);
    if(!legal(p)||returns.has(k))continue;
    returns.set(k,returns.get(key(queue[h]!))!+1);queue.push(p);
  }
  const start=key(fighter.position),fuel=fighter.fuel??0;
  const paths=[fighter.position],depth=new Map<number,number>([[start,0]]),parent=new Map<number,number>();
  let best:number|undefined,score=-Infinity;
  const returning=(returns.get(start)??Infinity)+5>=fuel;
  for(let h=0;h<paths.length;h++){
    const here=paths[h]!,k=key(here),steps=depth.get(k)!;
    if(k!==start&&steps+(returns.get(k)??Infinity)<=fuel){
      const unknown=directions.filter(d=>{const p={x:here.x+d.x,y:here.y+d.y};return playable(view,p)&&view.cells[key(p)]?.terrain===null;}).length;
      const stale=view.enemies.filter(e=>e.stale&&e.kind!=='submarine'&&Math.max(Math.abs(e.position.x-here.x),Math.abs(e.position.y-here.y))<=1).length;
      const information=unknown+stale*4;
      const value=returning?(baseKeys.has(k)?1000-steps:-Infinity):
        steps+(returns.get(k)??Infinity)+2<=fuel&&information>0?information/(steps+1):-Infinity;
      if(value>score){score=value;best=k;}
    }
    if(steps>=fuel)continue;
    for(const d of directions){const p={x:here.x+d.x,y:here.y+d.y},next=key(p);
      if(!legal(p)||depth.has(next))continue;
      depth.set(next,steps+1);parent.set(next,k);paths.push(p);
    }
  }
  if(best===undefined)return null;
  let next=best;while(parent.get(next)!==start){const previous=parent.get(next);if(previous===undefined)return null;next=previous;}
  return {x:next%view.width,y:Math.floor(next/view.width)};
}

export function playRedOpponent(game:Game):Game {
  if(game.active!=='red')throw new Error('Red AI must act during the red faction turn.');
  let g=game;
  const defenders=new Map<string,string>();
  for(const city of getPlayerView(g,'red').ownCities){
    const army=getPlayerView(g,'red').ownUnits.find(u=>u.kind==='army'&&!u.aboard&&equal(u.position,city.position));
    if(army)defenders.set(city.id,army.id);
  }
  const protectedCargo=new Set(defenders.values());
  // Troops with a known ground objective should not be swept back aboard at a
  // friendly supply port after landing. Keep this distinct from city guards:
  // assigned assault troops must still be allowed to move and capture.
  const boardingProtected=new Set(protectedCargo),groundView=getPlayerView(g,'red');
  for(const army of groundView.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&u.aiBeachhead&&
    groundView.cells.some(c=>c.city&&c.city.id===u.aiBeachhead&&c.city.owner!=='red'))){
    if(protectedCargo.has(army.id))continue;
    const adjacent=groundView.cells.some((c,i)=>c.city&&c.city.owner!=='red'&&
      Math.max(Math.abs(i%groundView.width-army.position.x),Math.abs(Math.floor(i/groundView.width)-army.position.y))<=1);
    if(adjacent||planAiGroundStep(groundView,army))boardingProtected.add(army.id);
  }
  const aiMove=(state:Game,id:string,to:Coord)=>moveUnit(state,id,to,boardingProtected);
  // Deterministic, knowledge-limited production. Red assigns armies first;
  // a coastal city may switch to transport production once forces accumulate.
  // This is provisional strategy, NOT reverse-engineered historical AI.
  for(const city of getPlayerView(g,'red').ownCities){
    const ownUnits=getPlayerView(g,'red').ownUnits;
    const armyCount=aiLocalArmyReserve(getPlayerView(g,'red'),city.position);
    const transportCount=ownUnits.filter(u=>u.kind==='transport').length;
    const view=getPlayerView(g,'red');
    const navalThreat=view.enemies.some(e=>!e.stale&&e.kind==='transport');
    // Transport protection survives casualties and the end of reconnaissance.
    // This is ongoing demand, not a fixed cap on fleet production.
    const desiredScouts=Math.max(navalThreat||transportCount>0?2:1,Math.ceil(view.ownCities.length/2));
    const scoutingAssigned=ownUnits.filter(u=>u.kind==='destroyer').length+
      view.ownCities.filter(c=>c.id!==city.id&&c.production==='destroyer').length>=desiredScouts;
    const knownObjective=view.cells.some(c=>c.city&&c.city.owner!=='red');
    const probe:Unit={id:'production-scout',kind:'destroyer',owner:'red',position:city.position,
      aboard:null,damage:0,spent:0,fuel:null,order:{kind:'none'}};
    const scoutNeeded=armyCount>=1&&!scoutingAssigned&&(!knownObjective||desiredScouts>1)&&
      isCoastal(g,city.position)&&(transportCount>0||navalThreat||planAiNavalScoutStep(view,probe)!==null);
    // Finish committed ships rather than repeatedly discarding their progress.
    const totalArmies=ownUnits.filter(u=>u.kind==='army').length;
    const hostileKnown=view.cells.some(c=>c.city&&c.city.owner!==null&&c.city.owner!=='red');
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
  for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='transport')){
    const plan=planAiBeachPickup(getPlayerView(g,'red'),ship,new Set([...boardingProtected,...beachWaiting]));
    if(plan){g=clone(g);const actual=g.units.find(u=>u.id===ship.id)!;actual.aiPickup={armies:ship.aiPickup?.armies??plan.armies,startedRound:ship.aiPickup?.startedRound??g.round};for(const [id,step] of Object.entries(plan.armySteps))beachArmySteps.set(id,step);beachAssignments.set(ship.id,actual.aiPickup.armies);for(const id of actual.aiPickup.armies)beachWaiting.add(id);}
    else if(ship.aiPickup){g=clone(g);delete g.units.find(u=>u.id===ship.id)!.aiPickup;}
  }
  // Loading consumes eligible troops' movement. Choose from own units only.
  for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='transport'&&!u.aboard)){
    const nearArmy=getPlayerView(g,'red').ownUnits.some(u=>u.kind==='army'&&!u.aboard&&
      Math.max(Math.abs(u.position.x-ship.position.x),Math.abs(u.position.y-ship.position.y))<=1);
    const atLoadingPort=getPlayerView(g,'red').ownCities.some(c=>isCoastal(g,c.position)&&
      Math.max(Math.abs(c.position.x-ship.position.x),Math.abs(c.position.y-ship.position.y))<=1);
    // Never re-embark an invasion force at the enemy beachhead. Those armies
    // need their next turn to assault the city rather than cycling aboard.
    if(nearArmy&&(atLoadingPort||beachAssignments.has(ship.id))&&g.units.filter(u=>u.aboard===ship.id).length<(capacity(ship)??0)){
      for(const army of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&!boardingProtected.has(u.id)&&
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
  for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='transport')){
    const view=getPlayerView(g,'red');
    const planned=updateAiTransportMission(view,ship);
    if(JSON.stringify(planned)!==JSON.stringify(ship)){
      g=clone(g);const actual=g.units.find(u=>u.id===ship.id)!;
      Object.assign(actual,planned);
      for(const key of ['aiObjective','aiMissionProgress','aiAvoidObjective'] as const)
        if(planned[key]===undefined)delete actual[key];
      if(planned.aiAvoidObjective?.id!==ship.aiAvoidObjective?.id&&planned.aiAvoidObjective)
        log(g,'red','system',`Transport ${ship.id} paused stalled objective ${planned.aiAvoidObjective.id} for 12 rounds.`);
      if(planned.aiObjective!==ship.aiObjective)
        log(g,'red','system',planned.aiObjective?`Transport ${ship.id} assigned city objective ${planned.aiObjective}.`:
          `Transport ${ship.id} cleared its city objective.`);
    }
  }

  const assembling=new Set<string>();
  for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='transport')){
    const plan=planAiTransportAssembly(getPlayerView(g,'red'),ship);
    if(JSON.stringify(plan.ship.aiAssembly)!==JSON.stringify(ship.aiAssembly)){
      g=clone(g);const actual=g.units.find(u=>u.id===ship.id)!;
      if(plan.ship.aiAssembly)actual.aiAssembly=plan.ship.aiAssembly;else delete actual.aiAssembly;
      if(plan.ship.aiAssembly)log(g,'red','system',`Transport ${ship.id} assembling for ${plan.ship.aiAssembly.objective}; wait limited to 12 rounds.`);
    }
    if(plan.wait)assembling.add(ship.id);
  }
  // Prefer landing near a known hostile/neutral objective; never target an
  // undiscovered city or use hidden terrain for route selection.
  for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='transport')){
    const view=getPlayerView(g,'red');
    const cargo=view.ownUnits.find(u=>u.kind==='army'&&u.aboard===ship.id&&u.spent<movementAllowance(u));
    const shore=assembling.has(ship.id)||beachAssignments.has(ship.id)?null:planAiReconLandingSquare(view,ship);
    if(cargo&&shore){try{g=disembarkArmy(g,cargo.id,shore);}catch{/* Actual movement remains authoritative. */}}
  }
  for(const landing of planAiLandingWave({...getPlayerView(g,'red'),ownUnits:getPlayerView(g,'red').ownUnits.filter(u=>!assembling.has(u.id)&&!assembling.has(u.aboard??'')&&!beachAssignments.has(u.id)&&!beachAssignments.has(u.aboard??''))})){
    // Each landing refreshes intelligence. A newly exposed defender can make
    // later reserved cells unsafe even though disembarkArmy still permits them.
    const view=getPlayerView(g,'red');
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
  if(g.round%10===0)for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>
    u.kind==='transport'&&u.aboard===null&&g.units.some(c=>c.aboard===u.id))){
    const passable=directions.some(d=>{
      const p={x:ship.position.x+d.x,y:ship.position.y+d.y};
      return playable(g,p)&&(terrainAt(g,p)==='sea'||cityAt(g,p)?.owner==='red')&&
        !g.units.some(other=>other.id!==ship.id&&!other.aboard&&equal(other.position,p));
    });
    if(!passable)log(g,'red','system',`Transport ${ship.id} blocked at (${ship.position.x}, ${ship.position.y}): no accessible adjacent sea or friendly port.`);
  }
  // Launch ready embarked scouts through the ordinary carrier action. A return
  // flight can board/refuel normally; another sortie starts on a later AI turn.
  for(const id of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='fighter'&&u.aboard).map(u=>u.id)){
    const view=getPlayerView(g,'red'),fighter=view.ownUnits.find(u=>u.id===id);
    if(!fighter||fighter.order.kind==='sentry'||fighter.spent>=movementAllowance(fighter))continue;
    const next=planAiFighterStep(view,fighter);if(!next)continue;
    try{g=launchFighter(g,id,next);}catch{/* Hidden or changed contacts interrupt launch. */}
  }
  const redUnitIds=g.units.filter(u=>u.owner==='red'&&!u.aboard).map(u=>u.id);
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  for(const id of redUnitIds){
    for(let step=0;step<5;step++){
      const view=getPlayerView(g,'red');
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
      const knownCities=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!=='red'?
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
        if(unit.kind==='transport'&&g.units.some(u=>u.aboard===id)&&known?.city?.owner==='red')
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
  for(const city of getPlayerView(g,'red').ownCities)if(city.production===null)g=selectProduction(g,city.id,'army');
  return g;
}

/** Reuse the existing Red strategy for Blue by exchanging faction labels
 * on a clone, including both sides' private intelligence. */
function swapAiFactions(game:Game):Game {
  const g=clone(game);
  const flip=(id:FactionId|null):FactionId|null=>id==='blue'?'red':id==='red'?'blue':id;
  g.active=flip(g.active)!;
  for(const p of g.players)p.id=flip(p.id)!;
  for(const c of g.cities)c.owner=flip(c.owner);
  for(const u of g.units)u.owner=flip(u.owner)!;
  for(const e of g.events)e.recipient=flip(e.recipient);
  const originalBlue=g.knowledge.blue;
  g.knowledge.blue=g.knowledge.red;
  g.knowledge.red=originalBlue;
  for(const k of Object.values(g.knowledge)){
    for(const sight of k.sightings)sight.owner=flip(sight.owner)!;
    for(const city of Object.values(k.cities))city.owner=flip(city.owner);
  }
  return g;
}
export function playBlueOpponent(game:Game):Game {
  if(game.active!=='blue')throw new Error('Blue AI requires Blue turn.');
  return swapAiFactions(playRedOpponent(swapAiFactions(game)));
}

/** Advance one blue-player round, allowing a rules-bound Red opponent to act. */
export function advanceLabRound(game:Game):Game {
  if(game.mode!=='rules-lab'||game.active!=='blue')throw new Error('Lab round advance requires blue player.');
  let g=game.scenario==='ai-vs-ai'?playBlueOpponent(game):game;
  g=endTurn(g);
  if((g.scenario==='close-quarters'||g.scenario==='ai-invasion'||g.scenario==='ai-vs-ai')&&g.active==='red')g=playRedOpponent(g);
  while(g.active!=='blue')g=endTurn(g);
  return g;
}
