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
function fillShip(g:Game,ship:Unit,portOnly=false):number {
  const cargoKind=ship.kind==='transport'?'army':'fighter';
  const capacityNow=capacity(ship)??0;
  let occupied=g.units.filter(u=>u.aboard===ship.id).length,loaded=0;
  for(const candidate of g.units){
    if(occupied>=capacityNow)break;
    if(candidate.owner!==ship.owner||candidate.kind!==cargoKind||candidate.aboard||
       candidate.id===ship.id)continue;
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
  if(order.kind==='move-to'){
    if(!playable(g,order.destination))throw new Error('Destination must be inside the playable map.');
    if(equal(unit.position,order.destination))unit.order={kind:'none'};
    else unit.order={kind:'move-to',destination:{...order.destination}};
  }else if(order.kind==='go-direction'){
    const {x,y}=order.direction;
    if(!Number.isInteger(x)||!Number.isInteger(y)||Math.max(Math.abs(x),Math.abs(y))!==1)throw new Error('Choose one of eight compass directions.');
    unit.order={kind:'go-direction',direction:{x,y}};
  }else if(order.kind==='patrol'){
    if(!playable(g,order.to)||!playable(g,order.from)||!equal(order.from,unit.position)||equal(order.to,order.from))throw new Error('Patrol requires a different playable destination and current starting position.');
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
  if(order.kind==='skip') unit.spent=movementAllowance(unit);
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
export function moveUnit(game:Game,id:string,to:Coord):Game {
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
    fillShip(g,unit,true);
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
export function endTurn(game:Game):Game {
  const g=clone(game),currentIndex=g.players.findIndex(p=>p.id===g.active);
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
function aiLandingReachesObjective(view:ReturnType<typeof getPlayerView>,landing:Coord):boolean {
  const {width,height,cells}=view;
  const key=(p:Coord)=>p.y*width+p.x;
  const start=key(landing);
  if(cells[start]?.terrain!=='land'||cells[start]?.city?.owner==='red')return false;
  const goals:Coord[]=[];
  for(let i=0;i<cells.length;i++)if(cells[i]?.city&&cells[i]!.city!.owner!=='red')
    goals.push({x:i%width,y:Math.floor(i/width)});
  if(!goals.length)return false;
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const queue=[start],seen=new Set<number>([start]);
  for(let head=0;head<queue.length;head++){
    const p={x:queue[head]!%width,y:Math.floor(queue[head]!/width)};
    if(goals.some(goal=>distance(p,goal)<=1))return true;
    for(const d of directions){
      const next={x:p.x+d.x,y:p.y+d.y};
      if(next.x<=0||next.y<=0||next.x>=width-1||next.y>=height-1)continue;
      const k=key(next),cell=cells[k];
      if(seen.has(k)||cell?.terrain!=='land'||cell?.city&&cell.city.owner!=='red')continue;
      seen.add(k);queue.push(k);
    }
  }
  return false;
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
function aiSeaExploreStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  const cells=view.cells;
  const start=ship.position.y*view.width+ship.position.x;
  const blocked=new Set(view.enemies.filter(e=>!e.stale).map(e=>e.position.y*view.width+e.position.x));
  for(const u of view.ownUnits)if(!u.aboard&&u.id!==ship.id)
    blocked.add(u.position.y*view.width+u.position.x);
  const queue=[start],seen=new Set<number>([start]),parent=new Map<number,number>();
  let found:number|undefined;
  for(let head=0;head<queue.length;head++){
    const current=queue[head]!;
    if(current!==start&&cells[current]?.terrain===null){found=current;break;}
    const p={x:current%view.width,y:Math.floor(current/view.width)};
    for(const d of directions){
      const next={x:p.x+d.x,y:p.y+d.y};
      if(next.x<=0||next.y<=0||next.x>=view.width-1||next.y>=view.height-1)continue;
      const i=next.y*view.width+next.x;
      if(seen.has(i)||blocked.has(i)||cells[i]?.terrain==='land'||cells[i]?.city||
         aiTransportThreatened(view,next))continue;
      seen.add(i);parent.set(i,current);queue.push(i);
    }
  }
  if(found===undefined)return null;
  let at=found;
  while(parent.get(at)!==start){
    const previous=parent.get(at);
    if(previous===undefined)return null;
    at=previous;
  }
  return {x:at%view.width,y:Math.floor(at/view.width)};
}

/** A transport carrying armies should not enter a square threatened by
 * a freshly sighted hostile ground unit. Stale reports are not omniscience.
 */
function aiTransportThreatened(view:ReturnType<typeof getPlayerView>,p:Coord):boolean {
  return view.enemies.some(enemy=>!enemy.stale&&enemy.kind==='army'&&
    Math.max(Math.abs(enemy.position.x-p.x),Math.abs(enemy.position.y-p.y))<=1);
}

function aiInvasionStep(view:ReturnType<typeof getPlayerView>,ship:Unit):Coord|null {
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const objectives=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!=='red'?
    [{x:i%view.width,y:Math.floor(i/view.width)}]:[]);
  const cells=view.cells;
  if(!objectives.length)return aiSeaExploreStep(view,ship);
  const destinations=new Set<number>();
  // Target known or unexplored sea squares that border a plausible landing
  // square within two cells of a discovered city.
  for(const city of objectives)for(let y=city.y-2;y<=city.y+2;y++)
    for(let x=city.x-2;x<=city.x+2;x++){
      const landing={x,y},indexLanding=y*view.width+x;
      if(x<=0||y<=0||x>=view.width-1||y>=view.height-1)continue;
      if(cells[indexLanding]?.terrain!=='land'||distance(landing,city)>2||
         !aiLandingReachesObjective(view,landing)||aiTransportThreatened(view,landing))continue;
      for(const d of directions){
        const sea={x:x+d.x,y:y+d.y};
        if(sea.x<=0||sea.y<=0||sea.x>=view.width-1||sea.y>=view.height-1)continue;
        const i=sea.y*view.width+sea.x;
        if((cells[i]?.terrain==='sea'||cells[i]?.terrain===null)&&
           !aiTransportThreatened(view,sea))destinations.add(i);
      }
    }
  if(!destinations.size)return aiSeaExploreStep(view,ship);
  const start=ship.position.y*view.width+ship.position.x;
  if(destinations.has(start)&&!aiTransportThreatened(view,ship.position))return null;
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
  if(found===undefined)return aiSeaExploreStep(view,ship);
  let at=found;
  while(parent.get(at)!==start){
    const previous=parent.get(at);
    if(previous===undefined)return aiSeaExploreStep(view,ship);
    at=previous;
  }
  return {x:at%view.width,y:Math.floor(at/view.width)};
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
    if(city&&city.owner!=='red')
      objectives.push({x:i%view.width,y:Math.floor(i/view.width)});
  }
  if(!objectives.length)return [];
  const options:Coord[]=[];
  for(const d of directions){
    const p={x:ship.position.x+d.x,y:ship.position.y+d.y};
    if(p.x<=0||p.y<=0||p.x>=view.width-1||p.y>=view.height-1)continue;
    const cell=view.cells[p.y*view.width+p.x];
    if(cell?.terrain!=='land'||cell.city?.owner==='red'||
       !objectives.some(o=>cheb(p,o)<=2)||!aiLandingReachesObjective(view,p))continue;
    // Disembarking into an army's immediate attack range risks the entire
    // invasion force; do not sacrifice cargo for a shorter route.
    if(aiTransportThreatened(view,p))continue;
    if(view.enemies.some(e=>!e.stale&&cheb(e.position,p)===0))continue;
    if(view.ownUnits.some(u=>!u.aboard&&cheb(u.position,p)===0))continue;
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

function aiGroundExploreStep(view:ReturnType<typeof getPlayerView>,army:Unit):Coord|null {
  const {width,height,cells}=view;
  const start=army.position.y*width+army.position.x;
  const occupied=new Set(view.ownUnits.filter(u=>!u.aboard&&u.id!==army.id)
    .map(u=>u.position.y*width+u.position.x));
  for(const enemy of view.enemies)if(!enemy.stale)
    occupied.add(enemy.position.y*width+enemy.position.x);
  const queue=[start],seen=new Set<number>([start]),parent=new Map<number,number>();
  let found:number|undefined;
  for(let head=0;head<queue.length;head++){
    const here=queue[head]!;
    const p={x:here%width,y:Math.floor(here/width)};
    for(const d of directions){
      const x=p.x+d.x,y=p.y+d.y,k=y*width+x;
      if(x<=0||y<=0||x>=width-1||y>=height-1||seen.has(k)||occupied.has(k))continue;
      const cell=cells[k];
      if(cell?.city&&cell.city.owner!=='red')continue;
      if(cell?.terrain==='sea')continue;
      seen.add(k);parent.set(k,here);
      if(cell?.terrain===null){found=k;break;}
      if(cell?.terrain==='land')queue.push(k);
    }
    if(found!==undefined)break;
  }
  if(found===undefined)return null;
  let at=found;
  while(parent.get(at)!==start){
    const previous=parent.get(at);
    if(previous===undefined)return null;
    at=previous;
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
    if(cell?.city&&cell.city.owner!=='red')
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
      if(cell?.city&&cell.city.owner!=='red')continue;
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
export function playRedOpponent(game:Game):Game {
  if(game.active!=='red')throw new Error('Red AI must act during the red faction turn.');
  let g=game;
  // Deterministic, knowledge-limited production. Red assigns armies first;
  // a coastal city may switch to transport production once forces accumulate.
  // This is provisional strategy, NOT reverse-engineered historical AI.
  for(const city of getPlayerView(g,'red').ownCities){
    const ownUnits=getPlayerView(g,'red').ownUnits;
    const armyCount=ownUnits.filter(u=>u.kind==='army').length;
    const transportCount=ownUnits.filter(u=>u.kind==='transport').length;
    const pick=armyCount>=3&&transportCount===0&&isCoastal(g,city.position)?'transport':
      armyCount>=8&&transportCount>0?null:'army';
    // Avoid an unlimited army pile-up when the invasion fleet is stalled.
    // Resume production automatically after casualties or transport losses.
    if(pick===null){
      if(city.production!==null){
        g=clone(g);
        const paused=g.cities.find(c=>c.id===city.id)!;
        paused.production=null;paused.progress=0;paused.firstCycle=true;
        log(g,'red','production',`Production paused at ${city.id}: sufficient reserve armies.`);
      }
    }else if(city.production!==pick)g=selectProduction(g,city.id,pick);
  }
  // Loading consumes eligible troops' movement. Choose from own units only.
  for(const ship of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='transport'&&!u.aboard)){
    const nearArmy=getPlayerView(g,'red').ownUnits.some(u=>u.kind==='army'&&!u.aboard&&
      Math.max(Math.abs(u.position.x-ship.position.x),Math.abs(u.position.y-ship.position.y))<=1);
    const atLoadingPort=getPlayerView(g,'red').ownCities.some(c=>isCoastal(g,c.position)&&
      Math.max(Math.abs(c.position.x-ship.position.x),Math.abs(c.position.y-ship.position.y))<=1);
    // Never re-embark an invasion force at the enemy beachhead. Those armies
    // need their next turn to assault the city rather than cycling aboard.
    if(nearArmy&&atLoadingPort&&g.units.filter(u=>u.aboard===ship.id).length<(capacity(ship)??0)){
      try{g=loadShip(g,ship.id);}catch{/* The unit remains available for normal tactics. */}
      // A partially filled AI transport may sail; do not keep it on a
      // stationary loading order forever.
      g=setOrder(g,ship.id,{kind:'none'});
    }
  }
  // Prefer landing near a known hostile/neutral objective; never target an
  // undiscovered city or use hidden terrain for route selection.
  for(const cargo of getPlayerView(g,'red').ownUnits.filter(u=>u.kind==='army'&&u.aboard)){
    if(cargo.spent>=movementAllowance(cargo))continue;
    const ship=g.units.find(u=>u.id===cargo.aboard);
    if(!ship)continue;
    const view=getPlayerView(g,'red');
    const options=planAiLandingSquares(view,ship);
    for(const square of options){
      try {g=disembarkArmy(g,cargo.id,square);break;} catch{/* No legal landing here. */}
    }
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
  const redUnitIds=g.units.filter(u=>u.owner==='red'&&!u.aboard).map(u=>u.id);
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  for(const id of redUnitIds){
    for(let step=0;step<5;step++){
      const view=getPlayerView(g,'red');
      const unit=view.ownUnits.find(u=>u.id===id);
      if(!unit||unit.spent>=movementAllowance(unit)||unit.order.kind==='sentry')break;
      if(unit.kind==='transport'&&!view.ownUnits.some(u=>u.aboard===id)){
        // Empty transports return to known friendly ports for another load.
        // A ship already in port waits for troops instead of wandering away.
        const ports=view.ownCities.filter(c=>isCoastal(g,c.position))
          .sort((a,b)=>Math.max(Math.abs(a.position.x-unit.position.x),Math.abs(a.position.y-unit.position.y))-
            Math.max(Math.abs(b.position.x-unit.position.x),Math.abs(b.position.y-unit.position.y)));
        if(ports.length){
          if(ports.some(port=>equal(port.position,unit.position)))break;
          let returned=false;
          for(const port of ports){
            const step=routeStep(g,unit,port.position);
            if(!step)continue;
            try {g=moveUnit(g,id,step);returned=true;break;}
            catch{/* An occupied or newly discovered square blocks this route. */}
          }
          if(returned)continue;
          break;
        }
      }
      if(unit.kind==='transport'&&view.ownUnits.some(u=>u.aboard===id)){
        const step=aiInvasionStep(view,unit);
        // Once in landing range, hold station for the next available cargo turn.
        if(!step)break;
        try {g=moveUnit(g,id,step);continue;}
        catch {break;} // Hidden contact interrupts the route; do not attack blindly.
      }
      // Destroyers scout charted water instead of drifting into arbitrary
      // nearby cells; this is modern experimental strategy, not DOS AI parity.
      if(unit.kind==='destroyer'){
        const next=planAiNavalScoutStep(view,unit);
        if(next){
          try {g=moveUnit(g,id,next);continue;}
          catch {break;}
        }
      }
      const visibleEnemies=view.enemies.filter(e=>!e.stale);
      const knownCities=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!=='red'?
        [{pos:{x:i%view.width,y:Math.floor(i/view.width)},city:cell.city}]:[]);
      // If no land route to a known objective exists, stage at a coastal port.
      // A known overseas city must not lure armies away from their transports.
      const groundPlan=unit.kind==='army'?planAiGroundStep(view,unit):null;
      // Scout from the opening turn, without waiting for a fleet or reserves.
      // Keep one active ground scout per faction. Other armies stage at ports
      // for transport loading rather than clogging the island with wanderers.
      const firstArmy=view.ownUnits.find(u=>u.kind==='army'&&!u.aboard);
      const isScout=unit.kind==='army'&&firstArmy?.id===unit.id&&
        (!view.ownUnits.some(u=>u.kind==='transport')||
         view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard).length>=3);
      if(unit.kind==='army'&&!isScout&&visibleEnemies.length===0&&groundPlan===null&&
         !knownCities.some(c=>distance(c.pos,unit.position)<=1)){
        const ports=view.ownCities.filter(c=>isCoastal(g,c.position))
          .sort((a,b)=>distance(a.position,unit.position)-distance(b.position,unit.position));
        if(ports.length){
          if(ports.some(port=>distance(port.position,unit.position)<=1))break;
          let staged=false;
          for(const port of ports){
            const next=routeStep(g,unit,port.position);
            if(!next)continue;
            try{g=moveUnit(g,id,next);staged=true;break;}
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
        try {g=moveUnit(g,id,target);moved=true;break;}catch{/* Try the next legal contact. */}
      }
      // Stop after any encounter; the AI makes no additional tactical decision
      // with a unit immediately after a battle or city assault.
      if(moved)break;
      if(unit.kind==='army'){
        const planned=groundPlan??(isScout?aiGroundExploreStep(view,unit):null);
        if(planned){
          try {g=moveUnit(g,id,planned);continue;}
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
        try {g=moveUnit(g,id,dest);moved=true;break;}catch{/* An obstacle remains an obstacle. */}
      }
      if(!moved)break;
      // Movement never loops blindly through contacts: the next iteration
      // recomputes the faction's actual, newly updated knowledge.
    }
  }
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
