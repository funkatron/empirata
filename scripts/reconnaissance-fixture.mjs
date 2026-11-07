import {createHash} from 'node:crypto';
import {makeCampaign} from './campaign-maps.mjs';

// Evaluation-only scenario. Both revisions must receive a clone of this state.
// No AI code or historical rules are modified by this fixture.
export function makeReconnaissanceFixture(engine,{layout='continents',seed=83,swap=false}={}){
 const g=makeCampaign(engine,layout,seed,{swap,cityCount:12,minSpacing:7});
 const faction=swap?'red':'blue';
 const home=g.cities.find(c=>c.owner===faction);
 const at=p=>g.tiles[p.y*g.width+p.x];
 const adjacent=p=>[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}].map(d=>({x:p.x+d.x,y:p.y+d.y})).filter(q=>q.x>1&&q.y>1&&q.x<g.width-2&&q.y<g.height-2);
 const land=adjacent(home.position).find(p=>at(p)==='land');
 const sea=adjacent(home.position).find(p=>at(p)==='sea');
 if(!land||!sea)throw Error('Fixture requires a coastal home city; select another seed/layout');
 const unit=(id,kind,position,aboard=null)=>({id,owner:faction,kind,position,damage:0,spent:0,fuel:null,order:{kind:'none'},aboard});
 const destroyer=unit('fixture-destroyer','destroyer',sea);
 const scout=unit('fixture-scout','army',land);
 const transport=unit('fixture-transport','transport',sea);
 const cargo=unit('fixture-cargo','army',sea,transport.id);
 g.units.push(destroyer,scout,transport,cargo);
 g.nextId=Math.max(g.nextId,10000);
 engine.updateAllKnowledge(g);
 // A previous enemy observation is retained only as faction-private memory.
 // It must be outside current visibility, or the knowledge updater disproves it.
 const k=g.knowledge[faction];
 const contact=[...Array(g.height).keys()].flatMap(y=>[...Array(g.width).keys()].map(x=>({x,y})))
  .filter(p=>at(p)==='land'&&!k.visible.includes(p.y*g.width+p.x))
  .sort((a,b)=>Math.max(Math.abs(a.x-land.x),Math.abs(a.y-land.y))-Math.max(Math.abs(b.x-land.x),Math.abs(b.y-land.y)))[0];
 if(!contact)throw Error('No hidden land contact available');
 g.round=10;
 k.sightings.push({id:'fixture-stale-contact',kind:'army',owner:faction==='blue'?'red':'blue',position:contact,observedRound:2});
 k.sightings.sort((a,b)=>a.id.localeCompare(b.id));
 k.freshEnemies=k.freshEnemies.filter(id=>id!=='fixture-stale-contact');
 const view=engine.getPlayerView(g,faction);
 if(!view.enemies.some(e=>e.id==='fixture-stale-contact'&&e.stale))throw Error('Stale contact not visible in private view');
 const digest=createHash('sha256').update(JSON.stringify(g)).digest('hex');
 return {state:g,faction,digest,scoutIds:[destroyer.id,scout.id],contact};
}
