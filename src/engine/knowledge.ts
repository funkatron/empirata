import { unitLabel } from './unit-names.js';
import type { CityIntel, FactionId, Game, Knowledge, PlayerCell, PlayerView, Unit } from './types.js';
import { directions, index, inMap, cityAt } from './world.js';

/** ALG-012: recovered DOS 8x8 observer/target detection matrix. */
export function canDetect(observer:Unit['kind']|'city', target:Unit['kind']):boolean {
  if(observer==='city')return true;
  if(target==='submarine')return observer==='destroyer'||observer==='submarine'||observer==='cruiser';
  if(observer==='submarine')return target!=='army'&&target!=='fighter';
  return true;
}


export function emptyKnowledge(game:Game): Knowledge {
  return {terrain:Array.from({length:game.tiles.length},()=>null),visible:[], sightings:[],freshEnemies:[],cities:{}};
}
/** Knowledge is an independent snapshot, never a live alias of the omniscient state. */
export function updateKnowledge(game:Game, faction:FactionId): void {
  const k=game.knowledge[faction];
  const visible=new Set<number>();
  // Terrain sight and target detection differ: submarines do not detect armies
  // or adjacent fighters. Cities, destroyers and cruisers detect submarines
  // (Interstel manual pp. 22–24, 26). Index coverage once per knowledge update.
  const observers=[...game.cities.filter(c=>c.owner===faction)
      .map(c=>({position:c.position,kind:'city' as const})),
    ...game.units.filter(u=>u.owner===faction&&!u.aboard)
      .map(u=>({position:u.position,kind:u.kind}))];
  const detection=new Map<Unit['kind'],Set<number>>();
  for(const origin of observers)for(const d of [{x:0,y:0},...directions]){
    const q={x:origin.position.x+d.x,y:origin.position.y+d.y};
    if(!inMap(game,q))continue;
    const cell=index(game,q);visible.add(cell);
    for(const target of ['army','fighter','destroyer','transport','submarine','cruiser','carrier','battleship'] as const){
      if(!canDetect(origin.kind,target))continue;
      if(!detection.has(target))detection.set(target,new Set());
      detection.get(target)!.add(cell);
    }
  }
  const detected=(kind:Unit['kind'],cell:number)=>detection.get(kind)?.has(cell)??false;
  const freshEnemies=new Set<string>();
  const previousSightings=new Map(k.sightings.map(s=>[s.id,s]));
  for(const i of visible) {
    k.terrain[i]=game.tiles[i] ?? null;
    const pos={x:i%game.width,y:Math.floor(i/game.width)};
    const city=cityAt(game,pos);
    if(city){
      const known=k.cities[city.id];
      const isOwned=city.owner===faction;
      const spyPresent=game.units.some(u=>u.owner===faction&&u.kind==='fighter'&&!u.aboard&&
        Math.max(Math.abs(u.position.x-pos.x),Math.abs(u.position.y-pos.y))<=1);
      const revealProduction=isOwned||spyPresent;
      const intel:CityIntel={id:city.id,owner:city.owner,
        production:revealProduction?city.production:(known?.production??null),
        productionKnown:revealProduction||(known?.productionKnown??false)};
      k.cities[city.id]=intel;
    }
  }
  for(const enemy of game.units){
    if(enemy.owner===faction||enemy.aboard) continue;
    const isSeen=detected(enemy.kind,index(game,enemy.position));
    if(isSeen){
      freshEnemies.add(enemy.id);
      previousSightings.set(enemy.id,{id:enemy.id,kind:enemy.kind,owner:enemy.owner,
        position:{...enemy.position}, observedRound:game.round});
    }
  }
  for(const [id,sight] of previousSightings){
    // If this square is visible and the type is detectable, stale enemy reports are disproven.
    if(detected(sight.kind,index(game,sight.position)) && !freshEnemies.has(id)) previousSightings.delete(id);
  }
  k.visible=Array.from(visible).sort((a,b)=>a-b);
  k.freshEnemies=Array.from(freshEnemies);
  k.sightings=Array.from(previousSightings.values()).sort((a,b)=>a.id.localeCompare(b.id));
}
export function updateAllKnowledge(game:Game,activateSentries=true):void {
  for(const player of game.players) updateKnowledge(game,player.id);
  if(!activateSentries)return;
  // ALG-012 wake set [D]: Sentry, Patrol-from, Wait (`skip` in Empirata UI).
  const wakesOnContact=(kind:typeof game.units[number]['order']['kind'])=>
    kind==='sentry'||kind==='patrol'||kind==='skip';
  for(const unit of game.units){
    if(unit.aboard||!wakesOnContact(unit.order.kind))continue;
    const knowledge=game.knowledge[unit.owner];
    if(!knowledge.sightings.some(s=>knowledge.freshEnemies.includes(s.id)&&
      Math.max(Math.abs(s.position.x-unit.position.x),Math.abs(s.position.y-unit.position.y))<=1))continue;
    const wakeLabel=unit.order.kind==='sentry'?'sentry awakened by adjacent enemy contact.':
      unit.order.kind==='patrol'?'patrol interrupted by adjacent enemy contact.':
      'wait order ended by adjacent enemy contact.';
    unit.order={kind:'none'};
    game.events.push({id:game.nextEventId++,round:game.round,recipient:unit.owner,
      kind:'system',message:`${unitLabel(unit)}: ${wakeLabel}`});
  }
}
function mergeCityIntel(a: CityIntel | null, b: CityIntel | null): CityIntel | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  if (a.id !== b.id) return a;
  const owner =
    a.owner === b.owner ? a.owner : a.owner === null ? b.owner : b.owner === null ? a.owner : null;
  const productionKnown = a.productionKnown || b.productionKnown;
  const production =
    productionKnown && a.productionKnown && b.productionKnown && a.production !== b.production
      ? null
      : a.productionKnown
        ? a.production
        : b.productionKnown
          ? b.production
          : null;
  return { id: a.id, owner, production, productionKnown };
}

/** CvC spectator overlay: union of two factions' private charts (not omniscient). */
export function mergeSpectatorPlayerViews(blue: PlayerView, red: PlayerView): PlayerView {
  if (blue.width !== red.width || blue.height !== red.height) {
    throw new Error('Cannot merge player views with different dimensions.');
  }
  const cells: PlayerCell[] = blue.cells.map((left, i) => {
    const right = red.cells[i]!;
    return {
      terrain: left.terrain ?? right.terrain,
      visible: left.visible || right.visible,
      city: mergeCityIntel(left.city, right.city),
    };
  });
  const enemiesById = new Map<string, PlayerView['enemies'][number]>();
  for (const sighting of [...blue.enemies, ...red.enemies]) {
    const prev = enemiesById.get(sighting.id);
    if (!prev) {
      enemiesById.set(sighting.id, structuredClone(sighting));
      continue;
    }
    enemiesById.set(sighting.id, {
      ...prev,
      stale: prev.stale && sighting.stale,
      position: !sighting.stale ? sighting.position : prev.position,
      kind: !sighting.stale ? sighting.kind : prev.kind,
      owner: !sighting.stale ? sighting.owner : prev.owner,
      observedRound: Math.max(prev.observedRound, sighting.observedRound),
    });
  }
  const events = [...blue.events, ...red.events]
    .sort((a, b) => a.id - b.id)
    .slice(-30);
  return {
    width: blue.width,
    height: blue.height,
    active: blue.active,
    round: blue.round,
    cells,
    ownCities: [...blue.ownCities, ...red.ownCities],
    ownUnits: [...blue.ownUnits, ...red.ownUnits],
    enemies: Array.from(enemiesById.values()).sort((a, b) => a.id.localeCompare(b.id)),
    events,
  };
}

/** The sole reader contract for player UI and future AI. */
export function getPlayerView(game:Game,faction:FactionId):PlayerView {
  if(!game.players.some(p=>p.id===faction)) throw new Error('Unknown faction');
  const k=game.knowledge[faction];
  const visible=new Set(k.visible);
  const cells:PlayerCell[]=k.terrain.map((terrain,i)=>{
    const x=i%game.width,y=Math.floor(i/game.width);
    const actual=cityAt(game,{x,y});
    const intel=actual ? (k.cities[actual.id]??null) : null;
    // City lookup only checks whether a known city exists; never reads live city properties.
    return {terrain,visible:visible.has(i),city:terrain===null?null:(intel?{...intel}:null)};
  });
  return {width:game.width,height:game.height,active:game.active,round:game.round,cells,
    ownCities:game.cities.filter(c=>c.owner===faction).map(c=>structuredClone(c)),
    ownUnits:game.units.filter(u=>u.owner===faction).map(u=>structuredClone(u)),
    enemies:k.sightings.map(s=>({...structuredClone(s),stale:!k.freshEnemies.includes(s.id)})),
    events:game.events.filter(e=>e.recipient===null||e.recipient===faction).slice(-30).map(e=>({...e}))};
}
