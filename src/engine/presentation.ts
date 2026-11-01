import type { Game, FactionId } from './types.js';

const ROOTS=['Ash','Brook','Cedar','Dun','Elm','Fair','Glen','Hart','Kings','Lake','Marsh','North','Oak','Pine','Queens','River'];
const ENDS=['bridge','bury','dale','field','ford','haven','hurst','mere','mont','mouth','port','stead','stone','ton','vale','wick'];
/** Stable fictional place names: ownership and visibility never affect names. */
export function cityName(id:string):string {
  const fixed:Record<string,string>={'c-blue':'Port Victoria','c-red':'Fort Meridian','c-frontier':'Oakridge','invasion-outpost':'Greyhaven'};
  if(Object.hasOwn(fixed,id))return fixed[id]!;
  const match=/^c([1-9]\d*)$/.exec(id);
  let n=0;
  if(match)n=Number(match[1])-1;
  else for(const ch of id)n=(Math.imul(n,31)+ch.charCodeAt(0))>>>0;
  const base=ROOTS[n%16]!+ENDS[Math.floor(n/16)%16]!;
  return n<256?base:`${base} ${Math.floor(n/256)+1}`;
}

export type GameOutcome = {state:'ongoing'} | {state:'finished';winner:FactionId|null;eliminated:FactionId[]};
/** Explicit lab elimination rule; unresolved DOS surrender heuristics are not guessed. */
export function gameOutcome(game:Game):GameOutcome {
  const survivors=game.players.filter(p=>game.cities.some(c=>c.owner===p.id)||game.units.some(u=>u.owner===p.id));
  if(survivors.length>1)return {state:'ongoing'};
  return {state:'finished',winner:survivors[0]?.id??null,eliminated:game.players.filter(p=>p.id!==survivors[0]?.id).map(p=>p.id)};
}
/** Sanitize reports using only the supplied player view's known identities. */
export function readableReport(message:string,units:ReadonlyArray<{id:string}>,cities:ReadonlyArray<{id:string}>):string {
  const ids=new Set(units.map(u=>u.id));
  // Unwrap legacy production first so its type does not consume the unit label.
  let result=message.replace(/(completed (?:Army|Fighter|Destroyer|Transport|Submarine|Cruiser|Carrier|Battleship)) \((.+)\)\.$/,'$1: $2.');
  // Strip the diagnostic wrapper, retaining parentheses inside a naval name.
  result=result.replace(/(^|[^\w-])([\w-]+) \(((?:[^()]|\([^()]*\))*)\)/g,
    (all,prefix,id,name)=>ids.has(id)||/^u\d+$/.test(id)?prefix+name:all);
  for(const city of [...cities].sort((a,b)=>b.id.length-a.id.length)){
    const escaped=city.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    result=result.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`,'g'),()=>cityName(city.id));
  }
  return result;
}
