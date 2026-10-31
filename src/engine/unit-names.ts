import type { FactionId, UnitType } from './types.js';

type Identity = { id:string; owner:FactionId; kind:UnitType };
const FACTION = {blue:'Blue',red:'Red',green:'Green'} as const;
// Fictional faction navy prefixes; names follow conventional-era US patterns.
const PREFIX = {blue:'BNS',red:'RNS',green:'GNS'} as const;
const SHIPS = {
  destroyer: {hull:'DD',names:['Fletcher','Spruance','O’Bannon','Johnston','Hoel','Heermann','Butler','Benson','Bristol','Nicholas','Taylor','Jenkins','Radford','Jervis','Jarvis','Duncan','Laffey','Kidd','Cassin','Downes','Allen','Porter','Mahan','Sims','Hughes','Morris','Anderson','Russell','Wilson','Barton','Aaron Ward','Buchanan']},
  transport: {hull:'AP',names:['Harris','Zeilin','McCawley','Barnett','George F. Elliott','Fuller','William P. Biddle','Heywood','Henry T. Allen','Arthur Middleton','Hunter Liggett','Leonard Wood','Joseph T. Dickman','Chateau Thierry','St. Mihiel','American Legion']},
  submarine: {hull:'SS',names:['Gato','Balao','Tench','Wahoo','Tang','Tautog','Silversides','Trigger','Barb','Flasher','Archerfish','Albacore','Dace','Darter','Drum','Finback','Grouper','Haddock','Halibut','Harder','Pampanito','Pargo','Perch','Pike','Pompano','Ray','Redfin','Salmon','Scamp','Seahorse','Skate','Swordfish']},
  cruiser: {hull:'CA',names:['Baltimore','Boston','Canberra','Quincy','Pittsburgh','Saint Paul','Columbus','Helena','Toledo','Bremerton','Fall River','Macon','Wichita','New Orleans','Astoria','Minneapolis','Tuscaloosa','San Francisco','Indianapolis','Portland','Louisville','Chicago','Houston','Augusta','Chester','Northampton','Salt Lake City','Pensacola']},
  carrier: {hull:'CV',names:['Enterprise','Yorktown','Hornet','Lexington','Saratoga','Ranger','Wasp','Essex','Intrepid','Franklin','Ticonderoga','Randolph','Hancock','Bennington','Boxer','Bon Homme Richard','Antietam','Shangri-La','Lake Champlain','Tarawa','Valley Forge','Philippine Sea','Midway','Coral Sea']},
  battleship: {hull:'BB',names:['Iowa','New Jersey','Missouri','Wisconsin','North Carolina','Washington','South Dakota','Indiana','Massachusetts','Alabama','Colorado','Maryland','West Virginia','Tennessee','California','New Mexico','Mississippi','Idaho','Pennsylvania','Arizona','Nevada','Oklahoma','New York','Texas','Wyoming','Arkansas','Florida','Utah','Delaware','North Dakota']}
} as const;
const SQUADRONS = ['Eagles','Falcons','Vipers','Hawks','Lancers','Tigers','Vigilantes','Sentinels','Ravens','Kestrels','Harriers','Mustangs'];

function serial(id:string):number {
  const match=/^u([1-9]\d*)$/.exec(id);
  if(match&&Number.isSafeInteger(Number(match[1])))return Number(match[1]);
  // Named scenario/fixture IDs also receive stable labels without using game RNG.
  let hash=2166136261;
  for(const ch of id)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
  return hash%999+1;
}
function ordinal(n:number):string {
  const last=n%100;
  return `${n}${last>=11&&last<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;
}
/** Presentation only: stable from identity, including saved and remembered units.
 * Serial numbers are game identifiers, not historical hull assignments or force sizes.
 * A repeated ship name retains a distinct hull number in long campaigns.
 */
export function unitName(unit:Identity):string {
  const n=serial(unit.id),faction=FACTION[unit.owner];
  if(unit.kind==='army')return `${faction} ${ordinal(n)} Infantry Division`;
  if(unit.kind==='fighter')return `${faction} ${ordinal(n)} Fighter Squadron “${SQUADRONS[(n-1)%SQUADRONS.length]}”`;
  const ship=SHIPS[unit.kind];
  return `${PREFIX[unit.owner]} ${ship.names[(n-1)%ship.names.length]} (${ship.hull}-${n})`;
}
/** Keep internal IDs in event logs for diagnostics and unambiguous fixture identities. */
export function unitLabel(unit:Identity):string { return `${unit.id} (${unitName(unit)})`; }
