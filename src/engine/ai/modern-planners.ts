import type { Coord, Unit } from '../types.js';
import { getPlayerView } from '../knowledge.js';
import { directions, equal, playable } from '../world.js';
import { capacity, movementAllowance } from '../units.js';

type PlayerView = ReturnType<typeof getPlayerView>;

/** Verify that a proposed beachhead has a confirmed land approach to a
 * discovered objective. Distance alone is insufficient when a bay or strait
 * separates the beach from the city. Uses only remembered PlayerView cells.
 */
function aiObjectiveLandRegion(view:PlayerView,ids?:ReadonlySet<string>):Set<number> {
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
function aiLandingReachesObjective(view:PlayerView,landing:Coord,targetId?:string):boolean {
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
export function planAiTransportExploreStep(view:PlayerView,ship:Unit):Coord|null {
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
export function aiTransportThreatened(view:PlayerView,p:Coord):boolean {
  return view.enemies.some(enemy=>!enemy.stale&&enemy.kind==='army'&&
    Math.max(Math.abs(enemy.position.x-p.x),Math.abs(enemy.position.y-p.y))<=1);
}

/** Stable city missions use private remembered intelligence, never hidden ownership. */
export function chooseAiTransportObjective(view:PlayerView,ship:Unit):string|undefined {
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
export function planAiConvoyStaging(view:PlayerView,ship:Unit):{staging:Coord;next:Coord|null;eta:number;groupEta:number}|null {
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
export function planAiTransportAssembly(view:PlayerView,ship:Unit):{ship:Unit;wait:boolean} {
  const next=structuredClone(ship),objective=chooseAiTransportObjective(view,ship);
  if(next.aiAssembly?.objective!==objective)delete next.aiAssembly;
  const cell=view.cells.findIndex(c=>c.city?.id===objective);
  if(!objective||cell<0||view.cells[cell]!.city!.owner===null)return {ship:next,wait:false};
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
export function updateAiTransportMission(view:PlayerView,ship:Unit):Unit {
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
function aiBeachAvailable(view:PlayerView,p:Coord):boolean {
  const cell=view.cells[p.y*view.width+p.x];
  return cell?.terrain==='land'&&!cell.city&&!aiTransportThreatened(view,p)&&
    !view.enemies.some(e=>!e.stale&&equal(e.position,p))&&
    !view.ownUnits.some(u=>!u.aboard&&equal(u.position,p));
}

function aiInvasionRoute(view:PlayerView,ship:Unit):{next:Coord|null;distance:number}|null {
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
export function planAiInvasionStep(view:PlayerView,ship:Unit):Coord|null {
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
export function planAiLandingSquares(view:PlayerView,ship:Unit):Coord[] {
  const cheb=(a:Coord,b:Coord)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const objectives:Coord[]=[];
  for(let i=0;i<view.cells.length;i++){
    const city=view.cells[i]?.city;
    if(city&&city.owner!==ship.owner&&!(ship.aiAvoidObjective?.id===city.id&&ship.aiAvoidObjective.until>view.round)&&(!ship.aiObjective||city.id===ship.aiObjective))
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
export function planAiLandingWave(view:PlayerView):{armyId:string;position:Coord}[] {
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
export function planAiNavalTransportIntercept(view:PlayerView,ship:Unit,investigateStale=false):Coord|null {
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
export function planAiCoastalSentryStep(view:PlayerView,ship:Unit):Coord|null {
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
export function planAiBeachPickup(view:PlayerView,ship:Unit,excluded:ReadonlySet<string>=new Set()):{next:Coord|null;armies:string[];armySteps:Record<string,Coord>}|null {
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
export function planAiNavalScoutStep(view:PlayerView,ship:Unit):Coord|null {
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
    // Stale contacts remain hypotheses, not known targets. Give nearby
    // unexplored frontiers a bounded bonus, without routing toward hidden map data.
    const stale=view.enemies.filter(e=>e.stale&&e.kind!=='submarine'&&
      Math.max(Math.abs(e.position.x-p.x),Math.abs(e.position.y-p.y))<=1).length;
    const nearby=unknown>0?view.enemies.filter(e=>e.stale&&e.kind!=='submarine'&&
      Math.max(Math.abs(e.position.x-p.x),Math.abs(e.position.y-p.y))>1&&
      Math.max(Math.abs(e.position.x-p.x),Math.abs(e.position.y-p.y))<=4).length:0;
    if(here!==start&&(unknown>0||stale>0)){
      const score=(unknown+stale*4+Math.min(nearby,2))/(steps+1);
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

export function planAiGroundScoutStep(view:PlayerView,ship:Unit):Coord|null {
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
    // Stale contacts remain hypotheses, not known targets. Give nearby
    // unexplored frontiers a bounded bonus, without routing toward hidden map data.
    const stale=view.enemies.filter(e=>e.stale&&e.kind!=='submarine'&&
      Math.max(Math.abs(e.position.x-p.x),Math.abs(e.position.y-p.y))<=1).length;
    const nearby=unknown>0?view.enemies.filter(e=>e.stale&&e.kind!=='submarine'&&
      Math.max(Math.abs(e.position.x-p.x),Math.abs(e.position.y-p.y))>1&&
      Math.max(Math.abs(e.position.x-p.x),Math.abs(e.position.y-p.y))<=4).length:0;
    if(here!==start&&(unknown>0||stale>0)){
      const score=(unknown+stale*4+Math.min(nearby,2))/(steps+1);
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
export function planAiGroundStep(view:PlayerView,army:Unit):Coord|null {
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
export function aiGroundRegion(view:PlayerView,origin:Coord):Set<number> {
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
export function aiLocalArmyReserve(view:PlayerView,origin:Coord):number {
  const seen=aiGroundRegion(view,origin);
  return view.ownUnits.filter(u=>u.kind==='army'&&!u.aboard&&seen.has(u.position.y*view.width+u.position.x)).length;
}

/** Opportunistic reconnaissance: land one scout on an unoccupied charted land
 * region with an unknown frontier. Space drop sites away from nearby supply
 * and scouts already ashore. No undiscovered city is used as a target.
 */
export function planAiReconLandingSquare(view:PlayerView,ship:Unit):Coord|null {
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
export function planAiFighterStep(view:PlayerView,fighter:Unit):Coord|null {
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
