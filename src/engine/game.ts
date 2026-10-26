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
export function setOrder(game:Game,unitId:string,order:UnitOrder):Game {
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
export function moveUnit(game:Game,id:string,to:Coord):Game {
  const g=clone(game),unit=g.units.find(u=>u.id===id);
  if(!unit||unit.owner!==g.active) throw new Error('That unit cannot be moved this turn.');
  if(unit.aboard) throw new RuleNotImplemented('CARGO','Transport unloading is not yet implemented.');
  if(unit.order.kind==='sentry') throw new Error('Clear sentry before moving.');
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
  if(unit.kind==='transport'&&g.units.filter(u=>u.aboard===unit.id).length>(capacity(unit)??0))
    throw new Error('Transport is overloaded. Unload excess armies before moving.');
  unit.position={...to}; unit.spent++;
  // Embarked units physically travel with the ship, but spend no movement themselves.
  for(const cargo of g.units.filter(u=>u.aboard===unit.id))cargo.position={...to};
  if(unit.kind==='transport'&&city?.owner===unit.owner){
    for(const cargo of g.units.filter(u=>u.aboard===unit.id)){
      cargo.aboard=null;cargo.position={...to};
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
/**
 * Close Quarters' preliminary computer opponent. It sees only its own PlayerView,
 * chooses known targets, and executes the very same moves as the human player.
 * This is NOT an attempt to reproduce the original game's AI strategy.
 * The older classic-lab fixture remains passive for reproducible system tests.
 */
function playRedOpponent(game:Game):Game {
  let g=game;
  const redUnitIds=g.units.filter(u=>u.owner==='red'&&!u.aboard).map(u=>u.id);
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  for(const id of redUnitIds){
    for(let step=0;step<5;step++){
      const view=getPlayerView(g,'red');
      const unit=view.ownUnits.find(u=>u.id===id);
      if(!unit||unit.spent>=movementAllowance(unit)||unit.order.kind==='sentry')break;
      const visibleEnemies=view.enemies.filter(e=>!e.stale);
      const knownCities=view.cells.flatMap((cell,i)=>cell.city&&cell.city.owner!=='red'?
        [{pos:{x:i%view.width,y:Math.floor(i/view.width)},city:cell.city}]:[]);
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
      const goals=[...visibleEnemies.map(e=>e.position),
        ...(unit.kind==='army'?knownCities.map(c=>c.pos):[])].sort((a,b)=>distance(a,unit.position)-distance(b,unit.position));
      const goal=goals[0];
      const possibilities=directions.map(d=>({x:unit.position.x+d.x,y:unit.position.y+d.y}))
        .filter(p=>playable(g,p))
        .sort((a,b)=>goal?distance(a,goal)-distance(b,goal):a.y-b.y||a.x-b.x);
      for(const dest of possibilities){
        const known=view.cells[dest.y*view.width+dest.x];
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

/** Advance one blue-player round, allowing a rules-bound Red opponent to act. */
export function advanceLabRound(game:Game):Game {
  if(game.mode!=='rules-lab'||game.active!=='blue')throw new Error('Lab round advance requires blue player.');
  let g=endTurn(game);
  if(g.scenario==='close-quarters'&&g.active==='red')g=playRedOpponent(g);
  while(g.active!=='blue')g=endTurn(g);
  return g;
}
