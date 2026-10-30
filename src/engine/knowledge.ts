import type { CityIntel, FactionId, Game, Knowledge, PlayerCell, PlayerView, Unit } from './types.js';
import { directions, index, inMap, terrainAt, cityAt } from './world.js';

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
  const surfaceObservers=new Set<number>(),submarineDetectors=new Set<number>();
  const origins=[...game.cities.filter(c=>c.owner===faction)
      .map(c=>({position:c.position,surface:true,submarines:true})),
    ...game.units.filter(u=>u.owner===faction&&!u.aboard)
      .map(u=>({position:u.position,surface:u.kind!=='submarine',
        submarines:u.kind==='cruiser'||u.kind==='destroyer'}))];
  for(const origin of origins)for(const d of [{x:0,y:0},...directions]){
    const q={x:origin.position.x+d.x,y:origin.position.y+d.y};
    if(!inMap(game,q))continue;
    const cell=index(game,q);visible.add(cell);
    if(origin.surface)surfaceObservers.add(cell);
    if(origin.submarines)submarineDetectors.add(cell);
  }
  const detected=(kind:Unit['kind'],cell:number)=>kind==='submarine'?submarineDetectors.has(cell):
    kind==='army'||kind==='fighter'?surfaceObservers.has(cell):visible.has(cell);
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
export function updateAllKnowledge(game:Game):void {
  for(const player of game.players) updateKnowledge(game,player.id);
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
