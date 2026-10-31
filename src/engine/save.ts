import type { Game } from './types.js';
import { updateAllKnowledge } from './knowledge.js';
import { STATS } from './units.js';
import { playable, equal } from './world.js';
const DATABASE='empirata-rules-lab';
const STORE='saves';
export function exportSave(game:Game):string {
  return JSON.stringify(game,null,2);
}
export function importSave(json:string):Game {
  const data:unknown=JSON.parse(json);
  if(typeof data!=='object'||data===null)throw new Error('Invalid save file.');
  const g=data as Partial<Game>;
  if(g.schema!==1||g.ruleset!=='interstel-2.05'||g.mode!=='rules-lab')throw new Error('Save version or ruleset is not supported.');
  if(g.width!==100||g.height!==60||!Array.isArray(g.tiles)||g.tiles.length!==6000||
    !g.tiles.every(t=>t==='land'||t==='sea'))throw new Error('Invalid world dimensions or terrain.');
  if(!Array.isArray(g.players)||!Array.isArray(g.units)||!Array.isArray(g.cities)||
    typeof g.active!=='string'||!g.players.some(p=>p?.id===g.active)||
    !Number.isInteger(g.round)||!Number.isInteger(g.nextId)||!Number.isInteger(g.nextEventId)||
    !g.knowledge||!g.rng||!Array.isArray(g.events))throw new Error('Invalid game structure.');
  const validFaction=(id:unknown)=>id==='blue'||id==='red'||id==='green';
  const finiteInt=(value:unknown)=>Number.isSafeInteger(value)&&Number.isFinite(value);
  const validPosition=(pos:any)=>pos&&finiteInt(pos.x)&&finiteInt(pos.y)&&playable(g as Game,pos);
  if(!finiteInt(g.round)||g.round!<1||!finiteInt(g.nextId)||g.nextId!<1||
    !finiteInt(g.nextEventId)||g.nextEventId!<1)throw new Error('Invalid counters.');
  if(!g.rng||!finiteInt(g.rng.seed)||g.rng.seed<0||g.rng.seed>0xffffffff||
    !finiteInt(g.rng.draws)||g.rng.draws<0)throw new Error('Invalid random state.');
  const playerIds=new Set<string>();
  for(const p of g.players){
    if(!p||!validFaction(p.id)||playerIds.has(p.id)||p.productionEfficiency!==50||p.combatEfficiency!==50)
      throw new Error('Invalid faction settings.');
    playerIds.add(p.id);
  }
  const validOwner=(owner:unknown)=>owner===null||(typeof owner==='string'&&playerIds.has(owner));
  const cityIds=new Set<string>();
  const cityPositions=new Set<number>();
  for(const city of g.cities){
    if(!city||typeof city.id!=='string'||!city.id||cityIds.has(city.id)||!validPosition(city.position)||
      !validOwner(city.owner)||!(city.production===null||Object.hasOwn(STATS,city.production))||
      !finiteInt(city.progress)||city.progress<0||typeof city.firstCycle!=='boolean')throw new Error('Invalid city entry.');
    const tile=city.position.y*100+city.position.x;
    if(cityPositions.has(tile))throw new Error('Duplicate city position.');
    cityIds.add(city.id);cityPositions.add(tile);
  }
  const unitIds=new Set<string>();
  for(const u of g.units){
    if(!u||typeof u.id!=='string'||!u.id||unitIds.has(u.id)||!playerIds.has(u.owner)||
      !Object.hasOwn(STATS,u.kind)||!validPosition(u.position)||
      !finiteInt(u.spent)||u.spent<0||!finiteInt(u.damage)||u.damage<0||
      !(u.fuel===null||(finiteInt(u.fuel)&&u.fuel>=0)))throw new Error('Invalid unit entry.');
    if(u.aiObjective!==undefined&&(u.kind!=='transport'||typeof u.aiObjective!=='string'||!cityIds.has(u.aiObjective)))
      throw new Error('Invalid AI transport objective.');
    if(u.aiBeachhead!==undefined&&(u.kind!=='army'||typeof u.aiBeachhead!=='string'||!cityIds.has(u.aiBeachhead)))
      throw new Error('Invalid AI beachhead objective.');
    if(u.aiAssembly!==undefined){
      const a=u.aiAssembly;
      if(u.kind!=='transport'||!a||(a.gathered!==undefined&&typeof a.gathered!=='boolean')||!cityIds.has(a.objective)||!finiteInt(a.startedRound)||a.startedRound<1||a.startedRound>g.round!||(a.staging!==undefined&&!validPosition(a.staging)))
        throw new Error('Invalid AI assembly state.');
    }
    if(u.aiMissionProgress!==undefined){
      const p=u.aiMissionProgress;
      if(!u.aiObjective||!p||!finiteInt(p.round)||p.round<1||p.round>g.round!||
        !finiteInt(p.bestDistance)||p.bestDistance<0||!finiteInt(p.cargo)||p.cargo<0)
        throw new Error('Invalid AI mission progress.');
    }
    if(u.aiAvoidObjective!==undefined){
      const a=u.aiAvoidObjective;
      if(u.kind!=='transport'||!a||!cityIds.has(a.id)||!finiteInt(a.until)||a.until<1)
        throw new Error('Invalid AI mission retry.');
    }
    const kind=u.order?.kind;
    if(!['none','skip','sentry','move-to','go-direction','patrol','go-home','escort','load-ship'].includes(kind))throw new Error('Invalid unit order.');
    if(kind==='sentry'&&u.kind==='fighter'&&u.aboard===null&&
      !g.cities.some(c=>c.owner===u.owner&&equal(c.position,u.position)))
      throw new Error('Sentry fighter requires a friendly base.');
    if(kind==='move-to'&&!validPosition((u.order as any).destination))throw new Error('Invalid Move To destination.');
    if(kind==='go-direction'){
      const d=(u.order as any).direction;
      if(!d||!finiteInt(d.x)||!finiteInt(d.y)||Math.max(Math.abs(d.x),Math.abs(d.y))!==1)
        throw new Error('Invalid direction.');
    }
    if(kind==='patrol'){
      const o=u.order as any;
      if(!validPosition(o.from)||!validPosition(o.to)||equal(o.from,o.to)||typeof o.outbound!=='boolean')
        throw new Error('Invalid patrol route.');
    }
    if(kind==='escort'&&(typeof (u.order as any).targetId!=='string'||!(u.order as any).targetId))
      throw new Error('Invalid escort target.');
    if(kind==='load-ship'&&u.kind!=='transport'&&u.kind!=='carrier')
      throw new Error('Only transport ships and carriers may wait for cargo.');
    unitIds.add(u.id);
  }
  for(const u of g.units){
    if(u.aboard!==null){
      const parent=g.units.find(v=>v.id===u.aboard);
      if(!parent||parent.id===u.id||parent.owner!==u.owner||!['transport','carrier'].includes(parent.kind)||
        (parent.kind==='transport'&&u.kind!=='army')||(parent.kind==='carrier'&&u.kind!=='fighter')||
        !equal(u.position,parent.position)||parent.aboard)
        throw new Error('Invalid embarked unit.');
    }
  }
  for(const u of g.units){
    if(u.order.kind==='escort'){
      const escortId=u.order.targetId;
      const target=g.units.find(v=>v.id===escortId);
      if(!target||target.id===u.id||target.owner!==u.owner||target.aboard)
        throw new Error('Invalid escort relationship.');
    }
  }
  for(const faction of playerIds){
    const k=g.knowledge?.[faction as keyof Game['knowledge']];
    if(!k||!Array.isArray(k.terrain)||k.terrain.length!==6000||
      !k.terrain.every(t=>t===null||t==='land'||t==='sea')||
      !Array.isArray(k.visible)||!Array.isArray(k.sightings)||!Array.isArray(k.freshEnemies)||
      !k.cities||typeof k.cities!=='object')throw new Error('Invalid faction knowledge.');
  }
  const result=structuredClone(g as Game);
  // Rebuild known visibility from current authoritative state while retaining remembered terrain and sightings.
  updateAllKnowledge(result,false); // Restoring a save must not execute activation transitions.
  return result;
}
function openDB():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DATABASE,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
export async function saveLocally(game:Game):Promise<void>{
  const db=await openDB();
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(exportSave(game),'autosave');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
export async function loadLocal():Promise<Game|null>{
  const db=await openDB();
  try{return await new Promise<Game|null>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('autosave');
    req.onsuccess=()=>{try{resolve(typeof req.result==='string'?importSave(req.result):null);}catch(err){reject(err);}};
    req.onerror=()=>reject(req.error);
  });}finally{db.close();}
}
