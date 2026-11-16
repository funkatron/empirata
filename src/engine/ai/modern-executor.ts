import type { Coord, FactionId, Game, Unit, UnitType } from '../types.js';
import { unitLabel } from '../unit-names.js';
import { getPlayerView } from '../knowledge.js';
import { cityAt, directions, equal, isCoastal, playable, terrainAt } from '../world.js';
import { STATS, capacity, movementAllowance } from '../units.js';
import {
  aiGroundRegion,
  aiLocalArmyReserve,
  aiTransportThreatened,
  planAiBeachPickup,
  planAiConvoyStaging,
  planAiCoastalSentryStep,
  planAiFighterStep,
  planAiGroundScoutStep,
  planAiGroundStep,
  planAiInvasionStep,
  planAiLandingSquares,
  planAiLandingWave,
  planAiNavalScoutStep,
  planAiNavalTransportIntercept,
  planAiReconLandingSquare,
  planAiTransportAssembly,
  updateAiTransportMission,
} from './modern-planners.js';

export type ModernAiGameOps = {
  moveUnit: (game: Game, id: string, to: Coord, protectedCargo: ReadonlySet<string>, mutable: boolean) => Game;
  selectProduction: (game: Game, cityId: string, kind: UnitType, mutable?: boolean) => Game;
  embarkArmy: (game: Game, armyId: string, transportId: string, mutable?: boolean) => Game;
  disembarkArmy: (game: Game, armyId: string, to: Coord, mutable?: boolean) => Game;
  setOrder: (game: Game, unitId: string, order: import('../types.js').UnitOrder, mutable?: boolean) => Game;
  launchFighter: (game: Game, fighterId: string, to: Coord, mutable?: boolean) => Game;
  routeStep: (game: Game, unit: Unit, destination: Coord) => Coord | null;
  log: (g: Game, recipient: FactionId | null, kind: Game['events'][number]['kind'], message: string) => void;
};

function clone(g: Game): Game {
  return structuredClone(g);
}

export function createModernAiExecutor(ops: ModernAiGameOps) {
  function playAiOpponent(game: Game, faction: FactionId): Game {

  if(game.active!==faction)throw new Error('AI must act during its faction turn.');
  // One private clone for the whole AI turn; public callers still see immutable ops.
  let g=clone(game);
  let view=getPlayerView(g,faction);
  let unitById=new Map(view.ownUnits.map(u=>[u.id,u]));
  let knownHostileCities:Array<{pos:Coord;city:NonNullable<(typeof view.cells)[number]['city']>}>|null=null;
  const syncView=()=>{
    view=getPlayerView(g,faction);
    unitById=new Map(view.ownUnits.map(u=>[u.id,u]));
    knownHostileCities=null;
  };
  const hostileCities=()=>{
    if(knownHostileCities)return knownHostileCities;
    const found:Array<{pos:Coord;city:NonNullable<(typeof view.cells)[number]['city']>}>=[];
    for(let i=0;i<view.cells.length;i++){
      const city=view.cells[i]?.city;
      if(city&&city.owner!==faction)found.push({pos:{x:i%view.width,y:Math.floor(i/view.width)},city});
    }
    knownHostileCities=found;
    return found;
  };
  const defenders=new Map<string,string>();
  for(const city of view.ownCities){
    const army=view.ownUnits.find(u=>u.kind==='army'&&!u.aboard&&equal(u.position,city.position));
    if(army)defenders.set(city.id,army.id);
  }
  const protectedCargo=new Set(defenders.values());
  // Troops with a known ground objective should not be swept back aboard at a
  // friendly supply port after landing. Keep this distinct from city guards:
  // assigned assault troops must still be allowed to move and capture.
  const boardingProtected=new Set(protectedCargo),groundView=view;
  for(const army of groundView.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&u.aiBeachhead&&
    groundView.cells.some(c=>c.city&&c.city.id===u.aiBeachhead&&c.city.owner!==faction))){
    if(protectedCargo.has(army.id))continue;
    const adjacent=groundView.cells.some((c,i)=>c.city&&c.city.owner!==faction&&
      Math.max(Math.abs(i%groundView.width-army.position.x),Math.abs(Math.floor(i/groundView.width)-army.position.y))<=1);
    if(adjacent||planAiGroundStep(groundView,army))boardingProtected.add(army.id);
  }
  const aiMove=(id:string,to:Coord)=>{ops.moveUnit(g,id,to,boardingProtected,true);syncView();};
  // Deterministic, knowledge-limited production. The AI assigns armies first;
  // a coastal city may switch to transport production once forces accumulate.
  // This is provisional strategy, NOT reverse-engineered historical AI.
  for(const city of view.ownCities){
    const ownUnits=view.ownUnits;
    const armyCount=aiLocalArmyReserve(view,city.position);
    const transportCount=ownUnits.filter(u=>u.kind==='transport').length;
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
    // Keep local troop production ahead of optional naval support when a
    // transport is waiting at this port with no army available to embark.
    // City garrisons and assigned beachhead troops are not expendable cargo.
    const waitingForCargo=ownUnits.some(ship=>ship.kind==='transport'&&!ship.aboard&&
      Math.max(Math.abs(ship.position.x-city.position.x),Math.abs(ship.position.y-city.position.y))<=1&&
      !ownUnits.some(cargo=>cargo.aboard===ship.id)&&
      !ownUnits.some(army=>army.kind==='army'&&!army.aboard&&!boardingProtected.has(army.id)&&
        Math.max(Math.abs(army.position.x-ship.position.x),Math.abs(army.position.y-ship.position.y))<=1));
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
    const pick=!defenders.has(city.id)?'army':committedShip?city.production!:waitingForCargo?'army':
      armyCount>=3&&assignedTransports<desiredTransports&&isCoastal(g,city.position)?'transport':fighterCount===0&&fighterNeeded?'fighter':scoutNeeded?'destroyer':
      carrierNeeded?'carrier':fighterNeeded?'fighter':'army';
    // Production time cannot be recovered: keep every factory active.
    if(city.production!==pick){ops.selectProduction(g,city.id,pick,true);syncView();}
  }
  const beachAssignments=new Map<string,string[]>(),beachWaiting=new Set<string>(),beachArmySteps=new Map<string,Coord>();
  for(const ship of view.ownUnits.filter(u=>u.kind==='transport')){
    const plan=planAiBeachPickup(view,ship,new Set([...boardingProtected,...beachWaiting]));
    if(plan){const actual=g.units.find(u=>u.id===ship.id)!;actual.aiPickup={armies:ship.aiPickup?.armies??plan.armies,startedRound:ship.aiPickup?.startedRound??g.round};for(const [id,step] of Object.entries(plan.armySteps))beachArmySteps.set(id,step);beachAssignments.set(ship.id,actual.aiPickup.armies);for(const id of actual.aiPickup.armies)beachWaiting.add(id);syncView();}
    else if(ship.aiPickup){delete g.units.find(u=>u.id===ship.id)!.aiPickup;syncView();}
  }
  // Loading consumes eligible troops' movement. Choose from own units only.
  for(const ship of view.ownUnits.filter(u=>u.kind==='transport'&&!u.aboard)){
    const nearArmy=view.ownUnits.some(u=>u.kind==='army'&&!u.aboard&&
      Math.max(Math.abs(u.position.x-ship.position.x),Math.abs(u.position.y-ship.position.y))<=1);
    const atLoadingPort=view.ownCities.some(c=>isCoastal(g,c.position)&&
      Math.max(Math.abs(c.position.x-ship.position.x),Math.abs(c.position.y-ship.position.y))<=1);
    // Never re-embark an invasion force at the enemy beachhead. Those armies
    // need their next turn to assault the city rather than cycling aboard.
    if(nearArmy&&(atLoadingPort||beachAssignments.has(ship.id))&&g.units.filter(u=>u.aboard===ship.id).length<(capacity(ship)??0)){
      for(const army of view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&!boardingProtected.has(u.id)&&
        (atLoadingPort||beachAssignments.get(ship.id)?.includes(u.id)))){
        try{ops.embarkArmy(g,army.id,ship.id,true);syncView();}catch{/* Only eligible nearby troops board. */}
      }
      // A partially filled AI transport may sail; do not keep it on a
      // stationary loading order forever.
      ops.setOrder(g,ship.id,{kind:'none'},true);syncView();
    }
  }
  // Persist the discovered city mission across moves and turns. Only the
  // faction's remembered city ownership can select or invalidate a target.
  for(const ship of view.ownUnits.filter(u=>u.kind==='transport')){
    const planned=updateAiTransportMission(view,ship);
    if(JSON.stringify(planned)!==JSON.stringify(ship)){
      const actual=g.units.find(u=>u.id===ship.id)!;
      Object.assign(actual,planned);
      for(const key of ['aiObjective','aiMissionProgress','aiAvoidObjective'] as const)
        if(planned[key]===undefined)delete actual[key];
      if(planned.aiAvoidObjective?.id!==ship.aiAvoidObjective?.id&&planned.aiAvoidObjective)
        ops.log(g,faction,'system',`${unitLabel(ship)} paused stalled objective ${planned.aiAvoidObjective.id} for 12 rounds.`);
      if(planned.aiObjective!==ship.aiObjective)
        ops.log(g,faction,'system',planned.aiObjective?`${unitLabel(ship)} assigned city objective ${planned.aiObjective}.`:
          `${unitLabel(ship)} cleared its city objective.`);
      syncView();
    }
  }

  const assembling=new Set<string>();
  for(const ship of view.ownUnits.filter(u=>u.kind==='transport')){
    const plan=planAiTransportAssembly(view,ship);
    if(JSON.stringify(plan.ship.aiAssembly)!==JSON.stringify(ship.aiAssembly)){
      const actual=g.units.find(u=>u.id===ship.id)!;
      if(plan.ship.aiAssembly)actual.aiAssembly=plan.ship.aiAssembly;else delete actual.aiAssembly;
      if(plan.ship.aiAssembly)ops.log(g,faction,'system',`${unitLabel(ship)} assembling for ${plan.ship.aiAssembly.objective}; wait limited to 12 rounds.`);
      syncView();
    }
    if(plan.wait)assembling.add(ship.id);
  }
  // Prefer landing near a known hostile/neutral objective; never target an
  // undiscovered city or use hidden terrain for route selection.
  for(const ship of view.ownUnits.filter(u=>u.kind==='transport')){
    const cargo=view.ownUnits.find(u=>u.kind==='army'&&u.aboard===ship.id&&u.spent<movementAllowance(u));
    const shore=assembling.has(ship.id)||beachAssignments.has(ship.id)?null:planAiReconLandingSquare(view,ship);
    if(cargo&&shore){try{ops.disembarkArmy(g,cargo.id,shore,true);syncView();}catch{/* Actual movement remains authoritative. */}}
  }
  for(const landing of planAiLandingWave({...view,ownUnits:view.ownUnits.filter(u=>!assembling.has(u.id)&&!assembling.has(u.aboard??'')&&!beachAssignments.has(u.id)&&!beachAssignments.has(u.aboard??''))})){
    // Each landing refreshes intelligence. A newly exposed defender can make
    // later reserved cells unsafe even though disembarkArmy still permits them.
    const cargo=view.ownUnits.find(u=>u.id===landing.armyId);
    const ship=view.ownUnits.find(u=>u.id===cargo?.aboard);
    if(!ship||!planAiLandingSquares(view,ship).some(p=>equal(p,landing.position)))continue;
    try {
      ops.disembarkArmy(g,landing.armyId,landing.position,true);
      const landed=g.units.find(u=>u.id===landing.armyId);
      if(landed&&ship.aiObjective)landed.aiBeachhead=ship.aiObjective;
      syncView();
    }
    catch{/* Actual movement remains authoritative if a hidden contact blocks landing. */}
  }
  // Report genuine geographic blockages at a bounded cadence rather than
  // allowing silent centuries of stalled naval operations.
  if(g.round%10===0)for(const ship of view.ownUnits.filter(u=>
    u.kind==='transport'&&u.aboard===null&&g.units.some(c=>c.aboard===u.id))){
    const passable=directions.some(d=>{
      const p={x:ship.position.x+d.x,y:ship.position.y+d.y};
      return playable(g,p)&&(terrainAt(g,p)==='sea'||cityAt(g,p)?.owner===faction)&&
        !g.units.some(other=>other.id!==ship.id&&!other.aboard&&equal(other.position,p));
    });
    if(!passable)ops.log(g,faction,'system',`${unitLabel(ship)} blocked at (${ship.position.x}, ${ship.position.y}): no accessible adjacent sea or friendly port.`);
  }
  // Launch ready embarked scouts through the ordinary carrier action. A return
  // flight can board/refuel normally; another sortie starts on a later AI turn.
  for(const id of view.ownUnits.filter(u=>u.kind==='fighter'&&u.aboard).map(u=>u.id)){
    const fighter=view.ownUnits.find(u=>u.id===id);
    if(!fighter||fighter.order.kind==='sentry'||fighter.spent>=movementAllowance(fighter))continue;
    const next=planAiFighterStep(view,fighter);if(!next)continue;
    try{ops.launchFighter(g,id,next,true);syncView();}catch{/* Hidden or changed contacts interrupt launch. */}
  }
  const activeUnitIds=g.units.filter(u=>u.owner===faction&&!u.aboard).map(u=>u.id);
  const distance=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  for(const id of activeUnitIds){
    let returningToSupply=false;
    for(let step=0;step<5;step++){
      const unit=unitById.get(id);
      if(!unit||unit.spent>=movementAllowance(unit)||unit.order.kind==='sentry')break;
      if(protectedCargo.has(id))break;
      if(beachWaiting.has(id)){const step=beachArmySteps.get(id);if(step){try{aiMove(id,step);}catch{/* Replan next turn if another troop blocks the path. */}}break;}
      if(assembling.has(id)){
        const recruiting=view.ownCities.some(c=>c.production==='army'&&distance(c.position,unit.position)<=1)&&
          view.ownUnits.filter(u=>u.aboard===id).length<(capacity(unit)??0);
        const staging=recruiting?null:planAiConvoyStaging(view,unit);
        if(staging?.next){try{aiMove(id,staging.next);continue;}catch{/* Reassess blocked station next turn. */}}
        break;
      }
      const intercept=planAiNavalTransportIntercept(view,unit);
      if(intercept){
        const attacking=view.enemies.some(e=>!e.stale&&e.kind==='transport'&&equal(e.position,intercept));
        try{aiMove(id,intercept);if(attacking)break;continue;}catch{break;}
      }
      if(unit.kind==='fighter'){
        const next=planAiFighterStep(view,unit);if(!next)break;
        try{aiMove(id,next);continue;}catch{break;}
      }
      // Initial carrier role: remain a safe refueling station. Moving naval air
      // groups require the subsequent carrier/patrol coordination milestone.
      if(unit.kind==='carrier')break;
      if(unit.kind==='transport'&&(!view.ownUnits.some(u=>u.aboard===id)||beachAssignments.has(id))){
        if(beachAssignments.has(id)){
          const own=new Set(beachAssignments.get(id));
          const excluded=new Set([...boardingProtected,...view.ownUnits.filter(a=>a.kind==='army'&&!own.has(a.id)).map(a=>a.id)]);
          const pickup=planAiBeachPickup(view,unit,excluded);
          if(pickup){if(!pickup.next)break;try{aiMove(id,pickup.next);continue;}catch{break;}}
          beachAssignments.delete(id);delete g.units.find(u=>u.id===id)!.aiPickup;syncView();
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
            const step=ops.routeStep(g,unit,port.position);
            if(!step)continue;
            try {aiMove(id,step);returned=true;break;}
            catch{/* An occupied or newly discovered square blocks this route. */}
          }
          if(returned)continue;
          break;
        }
      }
      if(unit.kind==='transport'&&view.ownUnits.some(u=>u.aboard===id)){
        let step=planAiInvasionStep(view,unit);
        // A fleet with no known city or exploration route returns to supply
        // instead of holding indefinitely at a remote edge of the chart.
        if(!step&&(unit.spent===0||returningToSupply)&&!unit.aiObjective&&!planAiReconLandingSquare(view,unit)){
          const ports=view.ownCities.filter(c=>isCoastal(g,c.position))
            .sort((a,b)=>distance(a.position,unit.position)-distance(b.position,unit.position)||a.id.localeCompare(b.id));
          if(ports.some(c=>equal(c.position,unit.position)))break;
          for(const port of ports){
            step=ops.routeStep(g,unit,port.position);
            if(step&&aiTransportThreatened(view,step))step=null;
            if(step){returningToSupply=true;break;}
          }
        }
        // Once in landing range, hold station for the next available cargo turn.
        if(!step)break;
        try {aiMove(id,step);continue;}
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
          try{aiMove(id,target.position);engaged=true;break;}catch{/* Try the next legal contact. */}
        }
        if(engaged)break; // Resolve immediate threats before scouting or holding.
        const investigation=planAiNavalTransportIntercept(view,unit,true);
        if(investigation){try{aiMove(id,investigation);continue;}catch{break;}}
        const next=planAiNavalScoutStep(view,unit);
        if(next){
          try {aiMove(id,next);continue;}
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
            const step=ops.routeStep(g,unit,station);if(!step)continue;
            try{aiMove(id,step);repositioned=true;break;}catch{/* Try another known station. */}
          }
          if(repositioned)continue;
        }
        if(escort)break; // Hold protection beside an active loaded transport.
        const station=planAiCoastalSentryStep(view,unit);
        if(station){try{aiMove(id,station);continue;}catch{break;}}
        break; // Coastal sentry is reassessed next turn, including fresh contacts.
      }
      const visibleEnemies=view.enemies.filter(e=>!e.stale);
      const knownCities=hostileCities();
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
            const next=ops.routeStep(g,unit,port.position);
            if(!next)continue;
            try{aiMove(id,next);staged=true;break;}
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
        try {aiMove(id,target);moved=true;break;}catch{/* Try the next legal contact. */}
      }
      // Stop after any encounter; the AI makes no additional tactical decision
      // with a unit immediately after a battle or city assault.
      if(moved)break;
      if(unit.kind==='army'){
        const planned=groundPlan??(isScout?planAiGroundScoutStep(view,unit):null);
        if(planned){
          try {aiMove(id,planned);continue;}
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
        try {aiMove(id,dest);moved=true;break;}catch{/* An obstacle remains an obstacle. */}
      }
      if(!moved)break;
      // Movement never loops blindly through contacts: the next iteration
      // recomputes the faction's actual, newly updated knowledge.
    }
  }
  // Captures happen after the production pass; activate their factories now.
  syncView();
  for(const city of g.cities.filter(c=>c.owner===faction&&c.production===null)){
    ops.selectProduction(g,city.id,'army',true);
    syncView();
  }
  return g;
  }
  return { playAiOpponent };
}
