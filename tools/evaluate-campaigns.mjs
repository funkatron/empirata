import {advanceLabRound,getPlayerView,exportSave,importSave,planAiLandingSquares} from '../dist/engine/index.js';
import {makeCampaignMap,mapFamilies} from './campaign-maps.mjs';

// Optional long-running observation, deliberately separate from CI assertions.
const rounds=Number(process.env.CAMPAIGN_ROUNDS??200);
const seeds=(process.env.CAMPAIGN_SEEDS??'1,7,42').split(',').map(Number);
const families=(process.env.CAMPAIGN_MAPS??mapFamilies.join(',')).split(',');
if(!Number.isSafeInteger(rounds)||rounds<1||seeds.some(s=>!Number.isSafeInteger(s)||s<0||s>0xffffffff))
  throw new Error('Use positive integer rounds and unsigned 32-bit seeds.');
const sideStats=()=>({produced:0,landed:0,removedUnits:0,captures:0,lastCaptureRound:1,maxLoaded:0,
  landingOpportunityTurns:0,loadedTransportLosses:0,cargoLostWithTransport:0});
for(const family of families)for(const seed of seeds){
  let g=makeCampaignMap(family,seed);
  const stats={blue:sideStats(),red:sideStats()};
  const trackedEvents=new Set();
  const seenUnits=new Map(),loaded=new Map();
  for(let turn=0;turn<rounds;turn++){
    const loadedShips=g.units.filter(u=>u.kind==='transport').map(u=>({id:u.id,owner:u.owner,
      cargo:g.units.filter(c=>c.aboard===u.id).length})).filter(u=>u.cargo>0);
    for(const side of ['blue','red']){
      const view=getPlayerView(g,side);
      // The shared strategy uses Red-normalized views internally. Keep the
      // opportunity counter comparable for Blue without changing the game.
      if(side==='blue'){
        for(const cell of view.cells)if(cell.city)cell.city.owner=cell.city.owner==='blue'?'red':cell.city.owner==='red'?'blue':cell.city.owner;
      }
      stats[side].landingOpportunityTurns+=view.ownUnits.filter(u=>u.kind==='transport'&&
        view.ownUnits.some(c=>c.aboard===u.id)&&planAiLandingSquares(view,u).length>0).length;
    }
    g=advanceLabRound(g);
    // Exercise current-version persistence in every independently generated map.
    if(turn===Math.floor(rounds/2))g=importSave(exportSave(g));
    for(const e of g.events)if(!trackedEvents.has(e.id)){
      trackedEvents.add(e.id);
      if(stats[e.recipient]&&e.kind==='production'&&e.message.includes(' completed '))stats[e.recipient].produced++;
      if(stats[e.recipient]&&e.message.includes(' landed from '))stats[e.recipient].landed++;
      if(stats[e.recipient]&&e.kind==='combat'&&e.message.includes(' joined its permanent garrison.')){
        stats[e.recipient].captures++;stats[e.recipient].lastCaptureRound=e.round;
      }
    }
    const alive=new Set(g.units.map(u=>u.id));
    for(const ship of loadedShips)if(!alive.has(ship.id)){
      stats[ship.owner].loadedTransportLosses++;stats[ship.owner].cargoLostWithTransport+=ship.cargo;
    }
    for(const [id,owner] of seenUnits)if(!alive.has(id)){
      // Capturing armies are consumed as garrisons by the rules, so this
      // disappearance metric includes those armies as well as combat losses.
      stats[owner].removedUnits++;seenUnits.delete(id);
    }
    for(const u of g.units){
      seenUnits.set(u.id,u.owner);
      if(u.aboard){
        const ship=g.units.find(s=>s.id===u.aboard);
        if(!ship||ship.owner!==u.owner||ship.position.x!==u.position.x||ship.position.y!==u.position.y)
          throw new Error(`Broken cargo at ${family}/${seed}/${g.round}`);
      }
    }
    for(const side of ['blue','red']){
      const count=g.units.filter(u=>u.owner===side&&u.aboard).length;
      stats[side].maxLoaded=Math.max(stats[side].maxLoaded,count);
      for(const ship of g.units.filter(u=>u.owner===side&&u.kind==='transport'&&g.units.some(c=>c.aboard===u.id))){
        const cells=loaded.get(ship.id)??new Set();cells.add(ship.position.y*g.width+ship.position.x);loaded.set(ship.id,cells);
      }
    }
  }
  const result={family,seed,rounds,landFraction:g.tiles.filter(t=>t==='land').length/g.tiles.length};
  for(const side of ['blue','red']){
    const view=getPlayerView(g,side);
    result[side]={...stats[side],cities:view.ownCities.length,knownCities:view.cells.filter(c=>c.city).length,
      explored:view.cells.filter(c=>c.terrain!==null).length,units:view.ownUnits.length,
      roundsSinceCapture:g.round-stats[side].lastCaptureRound,
      pausedFactories:view.ownCities.filter(c=>c.production===null).length,
      transports:view.ownUnits.filter(u=>u.kind==='transport').map(u=>({id:u.id,cargo:view.ownUnits.filter(c=>c.aboard===u.id).length,
        visitedLoadedCells:loaded.get(u.id)?.size??0,objective:u.aiObjective??null}))};
  }
  console.log(JSON.stringify(result));
}
