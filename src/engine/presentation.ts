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
  // 16×16 stems cover common maps; never append disambiguating numerals.
  return ROOTS[n%16]!+ENDS[Math.floor(n/16)%16]!;
}

export type GameOutcome = {state:'ongoing'} | {state:'finished';winner:FactionId|null;eliminated:FactionId[]};
/** Explicit lab elimination rule; unresolved DOS surrender heuristics are not guessed. */
export function gameOutcome(game:Game):GameOutcome {
  const survivors=game.players.filter(p=>game.cities.some(c=>c.owner===p.id)||game.units.some(u=>u.owner===p.id));
  if(survivors.length>1)return {state:'ongoing'};
  return {state:'finished',winner:survivors[0]?.id??null,eliminated:game.players.filter(p=>p.id!==survivors[0]?.id).map(p=>p.id)};
}
/** One piece of a player-facing report: plain text, or a named unit/city reference. */
export type ReportPart =
  | {text:string}
  | {unit:string;name:string}
  | {city:string;name:string};

/** Split an engine report into plain text and named unit/city references.
 * Engine messages carry `id (Name)` unit labels and raw city ids; players only
 * ever see names. Internal algorithm tags such as `(ALG-AI-003)` are dropped.
 */
export function reportParts(message:string,units:ReadonlyArray<{id:string}>,cities:ReadonlyArray<{id:string}>):ReportPart[] {
  const ids=new Set(units.map(u=>u.id));
  // Unwrap legacy production first so its type does not consume the unit label.
  let text=message.replace(/(completed (?:Army|Fighter|Destroyer|Transport|Submarine|Cruiser|Carrier|Battleship)) \((.+)\)\.$/,'$1: $2.');
  text=text.replace(/\s*\(ALG-[A-Z0-9-]+\)/g,'');
  type Hit={start:number;end:number;part:ReportPart};
  const hits:Hit[]=[];
  // Unit labels: `id (Name)`, retaining parentheses inside a naval name.
  for(const m of text.matchAll(/(^|[^\w-])([\w-]+) \(((?:[^()]|\([^()]*\))*)\)/g)){
    const [,prefix,id,name]=m;
    if(!(ids.has(id!)||/^u\d+$/.test(id!)))continue;
    const start=m.index!+prefix!.length;
    hits.push({start,end:m.index!+m[0].length,part:{unit:id!,name:name!}});
  }
  const covered=(i:number)=>hits.some(h=>i>=h.start&&i<h.end);
  for(const city of [...cities].sort((a,b)=>b.id.length-a.id.length)){
    const escaped=city.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    for(const m of text.matchAll(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`,'g'))){
      if(covered(m.index!))continue;
      hits.push({start:m.index!,end:m.index!+m[0].length,part:{city:city.id,name:cityName(city.id)}});
    }
  }
  hits.sort((a,b)=>a.start-b.start);
  const parts:ReportPart[]=[];
  let at=0;
  for(const hit of hits){
    if(hit.start<at)continue;
    if(hit.start>at)parts.push({text:text.slice(at,hit.start)});
    parts.push(hit.part);at=hit.end;
  }
  if(at<text.length)parts.push({text:text.slice(at)});
  return parts;
}

/** Sanitize reports using only the supplied player view's known identities. */
export function readableReport(message:string,units:ReadonlyArray<{id:string}>,cities:ReadonlyArray<{id:string}>):string {
  return reportParts(message,units,cities).map(p=>'text' in p?p.text:p.name).join('');
}
