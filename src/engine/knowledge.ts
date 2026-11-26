import { unitLabel } from './unit-names.js';
import { clonePlain } from './clone.js';
import type { City, CityIntel, FactionId, Game, Knowledge, PlayerCell, PlayerView, Terrain, Unit } from './types.js';
import { directions, index, inMap } from './world.js';

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
  const cityByCell=citiesByCell(game);
  for(const i of visible) {
    k.terrain[i]=game.tiles[i] ?? null;
    const pos={x:i%game.width,y:Math.floor(i/game.width)};
    const city=cityByCell.get(i);
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
  const freshSets:Partial<Record<string,Set<string>>>={};
  for(const unit of game.units){
    if(unit.aboard||!wakesOnContact(unit.order.kind))continue;
    const knowledge=game.knowledge[unit.owner];
    const fresh=freshSets[unit.owner]??=new Set(knowledge.freshEnemies);
    if(!knowledge.sightings.some(s=>fresh.has(s.id)&&
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
      enemiesById.set(sighting.id, clonePlain(sighting));
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

/**
 * Cell index → city, built in reverse so the first city listed at a cell wins (same as
 * `cityAt`). Off-map cities are skipped so `y*width + x` cannot alias another cell.
 */
function citiesByCell(game:Pick<Game,'cities'|'width'|'height'>):Map<number,City> {
  const byCell=new Map<number,City>();
  for(let ci=game.cities.length-1;ci>=0;ci--){
    const c=game.cities[ci]!;
    if(c.position.x<0||c.position.y<0||c.position.x>=game.width||c.position.y>=game.height) continue;
    byCell.set(c.position.y*game.width+c.position.x,c);
  }
  return byCell;
}

type CellCache={
  cells:readonly PlayerCell[]; width:number; cities:Game['cities']; cityCount:number;
  terrain:Array<Terrain|null>; visible:number[]; intel:Map<string,CityIntel>;
};
/**
 * Cell grids keyed by the live Knowledge object. Ops mutate games in place, so every call
 * re-checks a snapshot of the inputs (terrain, visible, city intel, city list) before reuse.
 * The check is far cheaper than allocating a new 6,000-cell grid. Cells are frozen because
 * views share them.
 */
const cellCache=new WeakMap<Knowledge,CellCache>();

function sameArray<T>(a:readonly T[],b:readonly T[]):boolean {
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++) if(a[i]!==b[i])return false;
  return true;
}

function sameIntel(snapshot:Map<string,CityIntel>,cities:Record<string,CityIntel>):boolean {
  let n=0;
  for(const id in cities){
    const live=cities[id]!,seen=snapshot.get(id);
    if(!seen||seen.id!==live.id||seen.owner!==live.owner||seen.production!==live.production||
      seen.productionKnown!==live.productionKnown)return false;
    n++;
  }
  return n===snapshot.size;
}

function buildCells(game:Game,k:Knowledge,frozen:boolean):PlayerCell[] {
  const visible=new Set(k.visible);
  const cityByCell=citiesByCell(game);
  const freeze=frozen?Object.freeze:<T,>(o:T)=>o;
  return k.terrain.map((terrain,i)=>{
    const actual=cityByCell.get(i);
    const intel=actual ? (k.cities[actual.id]??null) : null;
    // City lookup only checks whether a known city exists; never reads live city properties.
    const city=terrain===null?null:(intel?freeze({...intel}):null);
    return freeze({terrain,visible:visible.has(i),city});
  });
}

function cachedCells(game:Game,k:Knowledge):readonly PlayerCell[] {
  const hit=cellCache.get(k);
  if(hit&&hit.width===game.width&&hit.cities===game.cities&&hit.cityCount===game.cities.length&&
    sameArray(hit.terrain,k.terrain)&&sameArray(hit.visible,k.visible)&&sameIntel(hit.intel,k.cities))
    return hit.cells;
  const cells=Object.freeze(buildCells(game,k,true));
  const intel=new Map<string,CityIntel>();
  for(const id in k.cities) intel.set(id,{...k.cities[id]!});
  cellCache.set(k,{cells,width:game.width,cities:game.cities,cityCount:game.cities.length,
    terrain:k.terrain.slice(),visible:k.visible.slice(),intel});
  return cells;
}

/** The sole reader contract for player UI and future AI. Returns fresh, mutable cells. */
export function getPlayerView(game:Game,faction:FactionId):PlayerView {
  return playerView(game,faction,false);
}

/**
 * Same view, but `cells` is a shared, frozen grid reused while the faction's knowledge is
 * unchanged. For engine AI readers that never mutate the view (classic executor helpers).
 */
export function getPlayerViewShared(game:Game,faction:FactionId):PlayerView {
  return playerView(game,faction,true);
}

function playerView(game:Game,faction:FactionId,shared:boolean):PlayerView {
  if(!game.players.some(p=>p.id===faction)) throw new Error('Unknown faction');
  const k=game.knowledge[faction];
  const cells=shared?(cachedCells(game,k) as PlayerCell[]):buildCells(game,k,false);
  const fresh=new Set(k.freshEnemies);
  return {width:game.width,height:game.height,active:game.active,round:game.round,cells,
    ownCities:game.cities.filter(c=>c.owner===faction).map(c=>clonePlain(c)),
    ownUnits:game.units.filter(u=>u.owner===faction).map(u=>clonePlain(u)),
    enemies:k.sightings.map(s=>({...clonePlain(s),stale:!fresh.has(s.id)})),
    events:game.events.filter(e=>e.recipient===null||e.recipient===faction).slice(-30).map(e=>({...e}))};
}
