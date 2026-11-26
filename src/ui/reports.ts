import type {Coord,Game,PlayerView} from '../engine/index.js';
import {reportParts} from '../engine/index.js';
import {text} from './inspector-panel.js';

type ReportEvent=PlayerView['events'][number];

/** Cities whose identity this faction knows (its chart), for name lookup. */
function knownCities(view:PlayerView):Array<{id:string;position:Coord}> {
  const out:Array<{id:string;position:Coord}>=[];
  view.cells.forEach((cell,index)=>{
    if(cell?.city)out.push({id:cell.city.id,position:{x:index%view.width,y:Math.floor(index/view.width)}});
  });
  return out;
}

/** Where a named reference can be shown right now, or null when it is gone or hidden. */
export function referenceTarget(view:PlayerView,ref:{unit?:string;city?:string}):Coord|null {
  if(ref.unit){
    const own=view.ownUnits.find(u=>u.id===ref.unit);
    if(own){
      if(own.aboard)return view.ownUnits.find(u=>u.id===own.aboard)?.position??null;
      return own.position;
    }
    return view.enemies.find(u=>u.id===ref.unit&&!u.stale)?.position??null;
  }
  if(ref.city)return knownCities(view).find(c=>c.id===ref.city)?.position??null;
  return null;
}

/** Developer notes about the lab and computer-player internals, not game events. */
const LAB_MESSAGE=/^(Classic DOS AI \(grade|Rules laboratory loaded\.|AI versus AI laboratory:|Clean computer campaign:)|(assigned city objective|paused stalled objective|cleared its city objective|assembling for .+; wait limited)/;
export function isLabMessage(event:{kind:string;message:string}):boolean {
  return event.kind==='system'&&LAB_MESSAGE.test(event.message);
}

/** Reports as HTML. Live, visible units and known cities become tappable names. */
export function reportsHtml(view:PlayerView,game:Game,showLab=false,limit=40):string {
  const events=showLab?view.events:view.events.filter(e=>!isLabMessage(e));
  if(!events.length)return '<p>No reports.</p>';
  const units=[...view.ownUnits,...view.enemies];
  const cities=game.cities;
  return [...events].reverse().slice(0,limit).map(event=>{
    const body=reportParts(event.message,units,cities).map(part=>{
      if('text' in part)return text(part.text);
      const attr='unit' in part?`data-unit="${text(part.unit)}"`:`data-city="${text(part.city)}"`;
      const ref='unit' in part?{unit:part.unit}:{city:part.city};
      return referenceTarget(view,ref)
        ?`<button type="button" class="report-link" ${attr}>${text(part.name)}</button>`
        :`<span class="report-gone">${text(part.name)}</span>`;
    }).join('');
    return `<div class="report"><span>ROUND ${event.round} / ${event.kind.toUpperCase()}</span>${body}</div>`;
  }).join('');
}

/** Map squares where combat reported since `sinceEventId` took place (best known position). */
export function combatSites(view:PlayerView,game:Game,sinceEventId:number):Coord[] {
  const units=[...view.ownUnits,...view.enemies];
  const sites=new Map<string,Coord>();
  for(const event of view.events as ReportEvent[]){
    if(event.id<sinceEventId||event.kind!=='combat')continue;
    for(const part of reportParts(event.message,units,game.cities)){
      if('text' in part)continue;
      const at=referenceTarget(view,'unit' in part?{unit:part.unit}:{city:part.city});
      if(at){sites.set(`${at.x},${at.y}`,at);break;}
    }
  }
  return [...sites.values()];
}
