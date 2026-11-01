import {endgameModal} from './endgame.js';
import {advanceLabRound,capacity,exportSave,getPlayerView,importSave,loadLocal,makeRulesLab,makeCloseQuartersLab,makeAiInvasionLab,makeAiVsAiLab,makeAiVsAiSkirmishLab,
  moveUnit,disembarkArmy,launchFighter,loadShip,unloadShip,runMoveToOrders,movementAllowance,requiredProductionTurns,saveLocally,selectProduction,setOrder,
  STATS,UNIT_TYPES,isCoastal,unitName,cityName,gameOutcome,readableReport} from '../engine/index.js';
import type {City,Coord,Game,Unit,UnitType,PlayerView} from '../engine/index.js';

const el=(id:string)=>document.getElementById(id)!;
const canvas=el('map') as HTMLCanvasElement;
const context=canvas.getContext('2d');
if(!context)throw new Error('Canvas 2D is unavailable.');
const ctx=context;
const resultModal=endgameModal(el('endgameDialog') as HTMLDialogElement,el('endgameTitle'),el('endgameDetail'),el('endgameInspect') as HTMLButtonElement,canvas);
let game:Game=makeCloseQuartersLab();
let observer:'blue'|'red'='blue';
let spectatorMode:'alternate'|'blue'|'red'='alternate';
let playback:ReturnType<typeof setTimeout>|null=null;
let playbackGeneration=0,roundsPerAdvance=1;
let observerRefreshPending=false;
function flushObserverBatch():void {
  if(!observerRefreshPending)return;
  observerRefreshPending=false;refresh();
  void saveLocally(game).catch(()=>uiMessage('Local save unavailable; use Export JSON.'));
}
let view:PlayerView=getPlayerView(game,observer);
let selectedUnit:string|null='u1',selectedCity:string|null=null;
let spectatorContact:string|null=null,spectatorCity:string|null=null;
let tileSize=30,cameraX=0,cameraY=0;
let down:{id:number;x:number;y:number;cameraX:number;cameraY:number;moved:boolean}|null=null;
const touches=new Map<number,{x:number;y:number}>();
let pinch:{distance:number;scale:number;worldX:number;worldY:number}|null=null;
let suppressTap=false;
let hydrated=false;
let choosingDestination=false;
let choosingOrder:'move-to'|'patrol'|'go-direction'|'escort'='move-to';
const colors={sea:'#23485f',land:'#516e50',unseen:'#0b1821',blue:'#68c4f1',red:'#f47c73',neutral:'#e2c37c'};
function uiMessage(message:string):void {el('toast').textContent=message;}
function pausePlayback():void {
  playbackGeneration++;
  if(playback!==null){clearTimeout(playback);playback=null;}
  const button=document.getElementById('autoPlay');if(button)button.textContent='▶ Play';
  (el('advanceRounds') as HTMLButtonElement).disabled=gameOutcome(game).state==='finished';
  (el('nextRound') as HTMLButtonElement).disabled=gameOutcome(game).state==='finished';
  el('roundProgress').hidden=true;
  flushObserverBatch();
}
/** Yield between individual rounds so painting, Pause and scenario changes
 * can interrupt even a 100-round advance. Never run overlapping timers.
 */
function startRoundPlayback(repeat:boolean):void {
  pausePlayback();if(game.scenario!=='ai-vs-ai'||gameOutcome(game).state==='finished')return;
  const generation=playbackGeneration;
  let target=roundsPerAdvance,completed=0;
  el('autoPlay').textContent='Ⅱ Pause';
  (el('advanceRounds') as HTMLButtonElement).disabled=true;
  (el('nextRound') as HTMLButtonElement).disabled=true;
  const progress=()=>{
    el('roundProgress').hidden=false;
    el('roundProgressText').textContent=`${completed} / ${target}`;
  };
  progress();
  const tick=()=>{
    if(generation!==playbackGeneration)return;
    if(completed===0){target=roundsPerAdvance;progress();}
    if(game.scenario!=='ai-vs-ai'||!dispatch(()=>advanceLabRound(game),true)){pausePlayback();return;}
    completed++;progress();
    if(gameOutcome(game).state==='finished'){pausePlayback();return;}
    if(completed===target){
      flushObserverBatch();
      if(!repeat){pausePlayback();uiMessage(`Advanced ${completed} ${completed===1?'round':'rounds'} to round ${game.round}.`);return;}
      completed=0;
      el('roundProgress').hidden=true;
      playback=setTimeout(tick,750);
    }else playback=setTimeout(tick,0);
  };
  playback=setTimeout(tick,repeat?750:0);
}
function dispatch(operation:()=>Game,deferObserverRefresh=false):boolean {
  if(gameOutcome(game).state==='finished'){uiMessage('Game over. Inspect the map, export the save, or start a new game.');return false;}
  try {
    const before=game.nextEventId;
    const previousRound=game.round;
    game=operation();
    if(game.scenario==='ai-vs-ai'&&spectatorMode==='alternate'&&game.round!==previousRound){
      // One visible perspective per round; never merge both knowledge maps.
      observer=(game.round-1)%2===0?'blue':'red';
      selectedUnit=null;selectedCity=null;spectatorContact=null;spectatorCity=null;
    }
    if(deferObserverRefresh){observerRefreshPending=true;return true;}
    view=getPlayerView(game,observer);
    if(selectedUnit&&!view.ownUnits.some(u=>u.id===selectedUnit))selectedUnit=null;
    refresh();
    const result=view.events.filter(e=>e.id>=before&&e.kind==='combat').at(-1);
    if(result)uiMessage(readableReport(result.message,[...view.ownUnits,...view.enemies],game.cities));
    void saveLocally(game).catch(()=>uiMessage('Local save unavailable; use Export JSON.'));
    return true;
  } catch(error) {uiMessage(error instanceof Error?error.message:String(error));return false;}
}
function resize():void{
  const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.floor(rect.width*ratio));canvas.height=Math.max(1,Math.floor(rect.height*ratio));
  ctx.setTransform(ratio,0,0,ratio,0,0); clamp();paint();
}
function clamp():void {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  cameraX=Math.max(0,Math.min(cameraX,Math.max(0,game.width*tileSize-w)));
  cameraY=Math.max(0,Math.min(cameraY,Math.max(0,game.height*tileSize-h)));
}
function focus(p:Coord):void{
  cameraX=p.x*tileSize-canvas.clientWidth/2;
  cameraY=p.y*tileSize-canvas.clientHeight/2;
  clamp();paint();
}
function zoom(change:number):void {
  const old=tileSize;
  tileSize=Math.max(Math.min(canvas.clientWidth/game.width,canvas.clientHeight/game.height),Math.min(45,tileSize+change));
  cameraX=(cameraX+canvas.clientWidth/2)*(tileSize/old)-canvas.clientWidth/2;
  cameraY=(cameraY+canvas.clientHeight/2)*(tileSize/old)-canvas.clientHeight/2;
  clamp();paint();
}
function fitWorld():void {
  tileSize=Math.min(canvas.clientWidth/game.width,canvas.clientHeight/game.height);
  cameraX=(game.width*tileSize-canvas.clientWidth)/2;
  cameraY=(game.height*tileSize-canvas.clientHeight)/2;
  clamp();paint();
}
function paint():void {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#08131b';ctx.fillRect(0,0,w,h);
  const sx=Math.max(0,Math.floor(cameraX/tileSize)), ex=Math.min(game.width,Math.ceil((cameraX+w)/tileSize));
  const sy=Math.max(0,Math.floor(cameraY/tileSize)), ey=Math.min(game.height,Math.ceil((cameraY+h)/tileSize));
  for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++){
    const i=y*game.width+x,c=view.cells[i]!;
    const px=x*tileSize-cameraX,py=y*tileSize-cameraY;
    ctx.fillStyle=c.terrain===null?colors.unseen:c.terrain==='land'?colors.land:colors.sea;
    ctx.fillRect(px,py,tileSize+0.25,tileSize+0.25);
    if(c.terrain!==null&&!c.visible){ctx.fillStyle='rgba(3,13,22,.52)';ctx.fillRect(px,py,tileSize,tileSize);}
    if(tileSize>=9){ctx.strokeStyle='rgba(120,159,166,.12)';ctx.lineWidth=.65;ctx.strokeRect(px+.3,py+.3,tileSize-.6,tileSize-.6);}
    if(c.city){
      const ink=c.city.owner==='blue'?colors.blue:c.city.owner==='red'?colors.red:colors.neutral;
      ctx.fillStyle=ink;const r=Math.max(3,tileSize*.29);
      ctx.fillRect(px+tileSize/2-r,py+tileSize/2-r,r*2,r*2);
      ctx.fillStyle='#122432';ctx.fillRect(px+tileSize/2-1.5,py+tileSize/2-1.5,3,3);
      if(c.city.id===selectedCity){ctx.strokeStyle='#fff7c4';ctx.lineWidth=2;ctx.strokeRect(px+2,py+2,tileSize-4,tileSize-4);}
    }
  }
  const displayUnits=[...view.enemies.map(e=>({id:e.id,kind:e.kind,position:e.position,owner:e.owner,stale:e.stale})),
    ...view.ownUnits.filter(u=>!u.aboard).map(u=>({id:u.id,kind:u.kind,position:u.position,owner:u.owner,stale:false}))];
  for(const u of displayUnits){
    const x=u.position.x*tileSize-cameraX,y=u.position.y*tileSize-cameraY;
    if(x<-tileSize||y<-tileSize||x>w||y>h)continue;
    const inset=tileSize*.08,side=tileSize*.84;
    ctx.globalAlpha=u.stale?.48:1;
    ctx.fillStyle=u.owner==='blue'?'#173f65':'#652923';
    ctx.fillRect(x+inset,y+inset,side,side);
    ctx.strokeStyle=u.owner==='blue'?colors.blue:colors.red;ctx.lineWidth=1.5;
    ctx.strokeRect(x+inset,y+inset,side,side);
    ctx.fillStyle=u.owner==='blue'?'#b6e5ff':'#ffc5be';
    ctx.font=`bold ${Math.max(10,tileSize*.52)}px ui-monospace, monospace`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(({army:'A',fighter:'F',destroyer:'D',transport:'T',submarine:'S',cruiser:'C',carrier:'V',battleship:'B'} as Record<UnitType,string>)[u.kind],x+tileSize/2,y+tileSize/2+.5);
    ctx.globalAlpha=1;
    if(u.id===selectedUnit){ctx.strokeStyle='#fff0a4';ctx.lineWidth=2.3;ctx.strokeRect(x+1,y+1,tileSize-2,tileSize-2);}
  }
}
function cellFromPointer(ev:PointerEvent):Coord {
  const rect=canvas.getBoundingClientRect();
  return {x:Math.floor((ev.clientX-rect.left+cameraX)/tileSize),y:Math.floor((ev.clientY-rect.top+cameraY)/tileSize)};
}
function tapTile(pos:Coord):void {
  if(game.scenario==='ai-vs-ai'){
    if(pos.x<0||pos.y<0||pos.x>=view.width||pos.y>=view.height)return;
    const own=view.ownUnits.filter(u=>!u.aboard&&u.position.x===pos.x&&u.position.y===pos.y);
    const enemies=view.enemies.filter(u=>!u.stale&&u.position.x===pos.x&&u.position.y===pos.y);
    const city=view.cells[pos.y*view.width+pos.x]?.city;
    const candidates=[...own.map(u=>({kind:'unit',id:u.id})),
      ...enemies.map(u=>({kind:'contact',id:u.id})),
      ...(city?[{kind:'city',id:city.id}]:[])];
    const current=candidates.findIndex(c=>c.kind==='unit'&&c.id===selectedUnit||
      c.kind==='contact'&&c.id===spectatorContact||
      c.kind==='city'&&c.id===spectatorCity);
    const chosen=candidates[(current+1)%candidates.length];
    selectedUnit=chosen?.kind==='unit'?chosen.id:null;
    selectedCity=chosen?.kind==='city'&&view.ownCities.some(c=>c.id===chosen.id)?chosen.id:null;
    spectatorContact=chosen?.kind==='contact'?chosen.id:null;
    spectatorCity=chosen?.kind==='city'?chosen.id:null;
    refresh();return;
  }
  if(choosingDestination&&selectedUnit){
    choosingDestination=false;
    const id=selectedUnit;
    const origin=view.ownUnits.find(u=>u.id===id)?.position;
    if(!origin)return;
    const dx=pos.x-origin.x,dy=pos.y-origin.y;
    if(choosingOrder==='escort'){
      const target=view.ownUnits.find(u=>u.id!==id&&!u.aboard&&u.position.x===pos.x&&u.position.y===pos.y);
      if(!target){uiMessage('Tap a different friendly unit to escort.');return;}
      if(dispatch(()=>runMoveToOrders(setOrder(game,id,{kind:'escort',targetId:target.id}))))
        uiMessage(`${knownUnitName(id)} is escorting ${unitName(target)}.`);
      return;
    }
    const order=choosingOrder==='go-direction'?
      {kind:'go-direction' as const,direction:{x:Math.sign(dx),y:Math.sign(dy)}}:
      choosingOrder==='patrol'?{kind:'patrol' as const,from:{...origin},to:pos,outbound:true}:
      {kind:'move-to' as const,destination:pos};
    if(dispatch(()=>runMoveToOrders(setOrder(game,id,order))))
      uiMessage(`${choosingOrder} order assigned for ${knownUnitName(id)}.`);
    return;
  }
  if(pos.x<0||pos.y<0||pos.x>=game.width||pos.y>=game.height)return;
  const embarked=selectedUnit?view.ownUnits.find(u=>u.id===selectedUnit&&u.aboard):null;
  if(embarked){
    const action=embarked.kind==='fighter'?launchFighter:disembarkArmy;
    if(dispatch(()=>action(game,embarked.id,pos))){
      uiMessage(`${unitName(embarked)} left its ship. Select the ship to manage remaining cargo.`);
    }
    return;
  }
  const units=view.ownUnits.filter(u=>!u.aboard&&u.position.x===pos.x&&u.position.y===pos.y);
  const cityHere=view.ownCities.find(c=>c.position.x===pos.x&&c.position.y===pos.y);
  if(units.length){
    // Cycling reaches the production screen even when friendly units occupy a city.
    if(cityHere && selectedUnit===units[units.length-1]?.id){
      selectedUnit=null;selectedCity=cityHere.id;refresh();return;
    }
    const last=units.findIndex(u=>u.id===selectedUnit);
    selectedUnit=units[(last+1)%units.length]!.id;
    selectedCity=null;refresh();return;
  }
  const cell=view.cells[pos.y*game.width+pos.x];
  if(selectedUnit){
    const unit=view.ownUnits.find(u=>u.id===selectedUnit);
    if(unit&&Math.max(Math.abs(unit.position.x-pos.x),Math.abs(unit.position.y-pos.y))===1){
      const targetCity=cell?.city?.owner!=='blue'?cell?.city:null;
      if(dispatch(()=>moveUnit(game,selectedUnit!,pos))&&targetCity){
        const newlyOwned=view.ownCities.find(c=>c.id===targetCity.id);
        if(newlyOwned){selectedUnit=null;selectedCity=newlyOwned.id;refresh();}
      }
      return;
    }
  }
  const city=view.ownCities.find(c=>c.position.x===pos.x&&c.position.y===pos.y);
  if(city){selectedCity=city.id;selectedUnit=null;refresh();return;}
  if(cell?.city){selectedCity=null;selectedUnit=null;uiMessage(`${cityName(cell.city.id)} · ${cell.city.owner??'neutral'} (read-only)`);refresh();return;}
  selectedCity=null;selectedUnit=null;refresh();
}
function knownUnitName(id:string):string {
  const unit=view.ownUnits.find(u=>u.id===id)??view.enemies.find(u=>u.id===id);
  return unit?unitName(unit):id;
}
function text(value:unknown):string{return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));}
function selectedUnitBlock(unit:Unit):string {
  const allowance=movementAllowance(unit),stats=STATS[unit.kind],possible=capacity(unit);
  return `<div class="selection-title">${text(unitName(unit))}</div><div class="subtle">${text(stats.name)}</div>
  <div class="subtle">${unit.position.x}, ${unit.position.y} · ${unit.order.kind==='sentry'?'Sentry':unit.order.kind==='move-to'?`Moving to ${unit.order.destination.x}, ${unit.order.destination.y}`:unit.order.kind==='go-direction'?`Continuing ${unit.order.direction.x},${unit.order.direction.y}`:unit.order.kind==='patrol'?`Patrolling ${unit.order.from.x},${unit.order.from.y} ↔ ${unit.order.to.x},${unit.order.to.y}`:unit.order.kind==='load-ship'?'Waiting to load cargo':unit.order.kind==='go-home'?'Returning home':unit.order.kind==='escort'?`Escorting ${text(knownUnitName(unit.order.targetId))}`:'Awaiting orders'}</div>
  <div class="data"><div class="datum"><small>Movement</small><strong>${Math.max(0,allowance-unit.spent)} / ${allowance}</strong></div>
  <div class="datum"><small>Damage</small><strong>${unit.damage} / ${stats.hitPoints}</strong></div>
  ${unit.kind==='fighter'?`<div class="datum"><small>Fuel</small><strong>${unit.fuel} / 20</strong></div>`:''}
  ${possible!==null?`<div class="datum"><small>Cargo capacity</small><strong>${possible}</strong></div>`:''}</div>
  ${(unit.kind==='transport'||unit.kind==='carrier')? `<div class="stat-note">Aboard: ${view.ownUnits.filter(u=>u.aboard===unit.id).length} / ${capacity(unit)??0}</div>
  <div class="actions"><button id="loadShipButton">Load Ship</button><button id="unloadShipButton">Unload Ship</button></div><div class="actions">${view.ownUnits.filter(u=>u.aboard===unit.id).map(u=>`<button class="cargoButton" data-cargo="${text(u.id)}">Select ${text(unitName(u))}</button>`).join('')}</div>`:''}
  ${unit.aboard?'<p class="stat-note">Embarked: tap an adjacent legal square to launch or disembark (if movement remains).</p>':''}
  <div class="actions"><button id="moveToButton">Move To</button><button id="directionButton">Go Direction</button><button id="patrolButton">Patrol</button><button id="homeButton">Go Home</button><button id="escortButton">Escort</button><button id="sentryButton">Sentry</button><button id="clearButton">Clear</button><button id="skipButton">Skip move</button></div>
  <p class="stat-note" style="margin-top:12px">Tap an adjacent tile for manual movement, or choose Move To and tap a distant destination. Armies can assault neutral or enemy cities. Combat uses the original manual's normal-efficiency odds with a seeded random stream.</p>`;
}
function selectedCityBlock(city:City):string {
  const coastal=isCoastal(game,city.position);
  const choices=UNIT_TYPES.filter(kind=>coastal||STATS[kind].domain!=='sea');
  const turns=city.production?requiredProductionTurns(city.production,city.firstCycle):null;
  return `<div class="selection-title">${text(cityName(city.id))}</div><div class="subtle">${coastal?'Coastal port':'Inland'} · ${city.position.x}, ${city.position.y}</div>
  <label class="subtle" for="productionSelect">Production</label>
  <select id="productionSelect"><option value="">Choose a unit…</option>${choices.map(kind=>`<option value="${kind}" ${city.production===kind?'selected':''}>${STATS[kind].name} · ${city.firstCycle?STATS[kind].first:STATS[kind].repeat} turns</option>`).join('')}</select>
  <div class="data"><div class="datum"><small>Factory progress</small><strong>${city.progress} / ${turns??'—'}</strong></div>
  <div class="datum"><small>Production phase</small><strong>${city.firstCycle?'Setup':'Repeat'}</strong></div></div>
  <p class="stat-note">Changing unit types discards unfinished production. Production advances at the beginning of your faction's turn.</p>`;
}
function spectatorUnitBlock(unit:Unit):string {
  const stats=STATS[unit.kind];
  const cargo=view.ownUnits.filter(u=>u.aboard===unit.id);
  return `<div class="selection-title">${text(unitName(unit))}</div><div class="subtle">${text(stats.name)}</div>
    <div class="subtle">${text(unit.owner)} · ${unit.position.x}, ${unit.position.y}</div>
    <div class="data"><div class="datum"><small>Movement remaining</small><strong>${Math.max(0,movementAllowance(unit)-unit.spent)}</strong></div>
    <div class="datum"><small>Damage</small><strong>${unit.damage} / ${stats.hitPoints}</strong></div>
    ${unit.kind==='fighter'?`<div class="datum"><small>Fuel</small><strong>${unit.fuel}</strong></div>`:''}
    ${capacity(unit)!==null?`<div class="datum"><small>Cargo</small><strong>${cargo.length} / ${capacity(unit)}</strong></div>`:''}</div>
    <p class="stat-note">Spectator inspection only. No orders can be issued.</p>`;
}
function spectatorCityBlock(city:City):string {
  const turns=city.production?requiredProductionTurns(city.production,city.firstCycle):null;
  return `<div class="selection-title">${text(cityName(city.id))}</div>
    <div class="subtle">${text(city.owner??'Neutral')} · ${city.position.x}, ${city.position.y}</div>
    <div class="data"><div class="datum"><small>Production</small><strong>${text(city.production??'None')}</strong></div>
    <div class="datum"><small>Progress</small><strong>${city.progress} / ${turns??'—'}</strong></div></div>
    <p class="stat-note">Spectator inspection only. No production changes allowed.</p>`;
}
function refresh():void {
  view=getPlayerView(game,observer);
  el('aiSpectator').hidden=game.scenario!=='ai-vs-ai';
  el('spectatorCard').hidden=game.scenario!=='ai-vs-ai';
  el('viewFaction').textContent=observer==='blue'?'Blue':'Red';
  (el('spectatorSide') as HTMLSelectElement).value=spectatorMode;
  if(game.scenario==='ai-vs-ai'){
    el('spectatorNow').textContent=`Currently viewing ${observer.toUpperCase()} intelligence · Round ${game.round}`;
    const blue=getPlayerView(game,'blue'),red=getPlayerView(game,'red');
    el('spectatorBlue').textContent=`${blue.ownCities.length} cities · ${blue.ownUnits.length} units`;
    el('spectatorRed').textContent=`${red.ownCities.length} cities · ${red.ownUnits.length} units`;
  }
  el('round').textContent=`ROUND ${game.round}`;
  el('cityCount').textContent=String(view.ownCities.length);
  el('unitCount').textContent=String(view.ownUnits.length);
  el('scenarioName').textContent=game.scenario==='ai-vs-ai'?'COMPUTER vs COMPUTER · EXPERIMENTAL':game.scenario==='ai-invasion'?'AI INVASION · DEMONSTRATION':game.scenario==='close-quarters'?'CLOSE QUARTERS · PLAYABLE':'CLASSIC RULES LAB';
  el('threatCount').textContent=String(view.enemies.filter(u=>!u.stale).length);
  const unit=view.ownUnits.find(u=>u.id===selectedUnit);
  const city=view.ownCities.find(c=>c.id===selectedCity);
  const inspector=el('inspector');
  if(unit)inspector.innerHTML=game.scenario==='ai-vs-ai'?spectatorUnitBlock(unit):selectedUnitBlock(unit);
  else if(city)inspector.innerHTML=game.scenario==='ai-vs-ai'?spectatorCityBlock(city):selectedCityBlock(city);
  else if(game.scenario==='ai-vs-ai'&&spectatorContact){
    const enemy=view.enemies.find(u=>u.id===spectatorContact&&!u.stale);
    inspector.innerHTML=enemy?
      `<div class="selection-title">${text(unitName(enemy))}</div><div class="subtle">${text(STATS[enemy.kind].name)}</div>
      <div class="subtle">${text(enemy.owner)} · ${enemy.position.x}, ${enemy.position.y}</div>
      <p class="stat-note">Visible enemy contact. Additional details are not available to this faction.</p>`:
      '<p>Enemy contact no longer visible.</p>';
  }
  else if(game.scenario==='ai-vs-ai'&&spectatorCity){
    const intel=view.cells.find(c=>c.city?.id===spectatorCity)?.city;
    inspector.innerHTML=intel?
      `<div class="selection-title">${text(cityName(intel.id))}</div>
      <div class="subtle">Known owner: ${text(intel.owner??'Neutral')}</div>
      <p class="stat-note">Remembered city intelligence. Production is not visible.</p>`:
      '<p>City intelligence unavailable.</p>';
  }
  else inspector.innerHTML=game.scenario==='ai-vs-ai'?'<p>Both factions are computer-controlled. Alternate the map viewpoint each round or choose a fixed side. The scorecards show both players’ own totals.</p>':'<p>Select a blue unit, then tap an adjacent enemy to attack. Select a city to assign production. Red will respond on the next round using a preliminary rules-bound AI.</p>';
  inspector.querySelectorAll<HTMLButtonElement>('.cargoButton').forEach(button=>button.addEventListener('click',()=>{
    selectedUnit=button.dataset.cargo??null;selectedCity=null;refresh();
    uiMessage('Tap adjacent land to disembark an army, or a free adjacent square to launch a fighter.');
  }));
  if(unit&&(unit.kind==='transport'||unit.kind==='carrier')){
    document.getElementById('loadShipButton')?.addEventListener('click',()=>{
      if(dispatch(()=>loadShip(game,unit.id)))
        uiMessage(`${unitName(unit)}: loading eligible adjacent units until full. Use Clear to stop waiting.`);
    });
    document.getElementById('unloadShipButton')?.addEventListener('click',()=>{
      if(dispatch(()=>unloadShip(game,unit.id)))
        uiMessage(`${unitName(unit)}: select a carried unit, then tap a legal landing square.`);
    });
  }
  const moveButton=document.getElementById('moveToButton');
  if(moveButton&&unit)moveButton.addEventListener('click',()=>{choosingOrder='move-to';choosingDestination=true;uiMessage('Tap a map tile to set destination. Drag to pan.');});
  for(const [button,kind,hint] of [['directionButton','go-direction','Tap an adjacent tile to choose a compass bearing.'],['patrolButton','patrol','Tap a destination for the patrol route.']] as const){
    document.getElementById(button)?.addEventListener('click',()=>{choosingOrder=kind;choosingDestination=true;uiMessage(hint);});
  }
  document.getElementById('homeButton')?.addEventListener('click',()=>{
    if(unit&&dispatch(()=>runMoveToOrders(setOrder(game,unit.id,{kind:'go-home'}))))
      uiMessage(`${unitName(unit)} returning to a friendly city.`);
  });
  document.getElementById('escortButton')?.addEventListener('click',()=>{
    choosingOrder='escort';choosingDestination=true;
    uiMessage('Tap another friendly unit to escort. Drag to pan.');
  });
  const productionSelect=document.getElementById('productionSelect') as HTMLSelectElement | null;
  if(productionSelect&&city)productionSelect.addEventListener('change',()=>{
    if(productionSelect.value)dispatch(()=>selectProduction(game,city.id,productionSelect.value as UnitType));
  });
  for(const [button,kind] of [['sentryButton','sentry'],['clearButton','none'],['skipButton','skip']] as const){
    const target=document.getElementById(button);
    if(target&&unit)target.addEventListener('click',()=>dispatch(()=>setOrder(game,unit.id,{kind})));
  }
  el('events').innerHTML=[...view.events].reverse().slice(0,8).map(e=>`<div class="report"><span>ROUND ${e.round} / ${e.kind.toUpperCase()}</span>${text(readableReport(e.message,[...view.ownUnits,...view.enemies],Object.values(view.cells.flatMap(c=>c.city?[c.city]:[]))))}</div>`).join('')||'<p>No reports.</p>';
  const outcome=gameOutcome(game),finished=outcome.state==='finished';
  el('gameResult').hidden=!finished;
  if(finished){
    el('gameResultTitle').textContent=outcome.winner===null?'Draw':game.scenario==='ai-vs-ai'?`${outcome.winner.toUpperCase()} wins`:outcome.winner==='blue'?'You won':'You lost';
    el('gameResultDetail').textContent=outcome.winner===null?'No faction has any cities or surviving units.':'Only the winning faction has cities or surviving units.';
  }
  resultModal.update(finished,el('gameResultTitle').textContent??'Game over',`${el('gameResultDetail').textContent} Finished in round ${game.round}. Inspect the final map, export this game, or start a new one.`);
  for(const id of ['autoPlay','advanceRounds','nextRound']) (el(id) as HTMLButtonElement).disabled=finished;
  if(finished)inspector.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select').forEach(control=>{if(!control.classList.contains('cargoButton'))control.disabled=true;});
  paint();
}
function pinchPoints():{x:number;y:number;distance:number}|null {
  if(touches.size<2)return null;
  const points=[...touches.values()];
  const a=points[0]!,b=points[1]!;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
}
function beginPinch():void {
  const p=pinchPoints();if(!p)return;
  const rect=canvas.getBoundingClientRect();
  pinch={distance:p.distance,scale:tileSize,
    worldX:(p.x-rect.left+cameraX)/tileSize,
    worldY:(p.y-rect.top+cameraY)/tileSize};
  suppressTap=true;down=null;
}
canvas.addEventListener('pointerdown',ev=>{
  if(ev.pointerType==='mouse'&&ev.button!==0)return;
  canvas.setPointerCapture(ev.pointerId);
  touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(touches.size===2){beginPinch();return;}
  if(touches.size>2){suppressTap=true;down=null;return;}
  if(suppressTap)return;
  down={id:ev.pointerId,x:ev.clientX,y:ev.clientY,cameraX,cameraY,moved:false};
  canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',ev=>{
  if(!touches.has(ev.pointerId))return;
  touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(pinch&&touches.size===2){
    const p=pinchPoints()!,rect=canvas.getBoundingClientRect();
    tileSize=Math.max(Math.min(canvas.clientWidth/game.width,canvas.clientHeight/game.height),
      Math.min(45,pinch.scale*p.distance/pinch.distance));
    cameraX=pinch.worldX*tileSize-(p.x-rect.left);
    cameraY=pinch.worldY*tileSize-(p.y-rect.top);
    clamp();paint();return;
  }
  if(!down||down.id!==ev.pointerId)return;
  const dx=ev.clientX-down.x,dy=ev.clientY-down.y;
  if(Math.abs(dx)+Math.abs(dy)>6)down.moved=true;
  if(down.moved){cameraX=down.cameraX-dx;cameraY=down.cameraY-dy;clamp();paint();}
});
function finishPointer(ev:PointerEvent,cancelled:boolean):void {
  if(!touches.has(ev.pointerId))return;
  touches.delete(ev.pointerId);
  if(pinch||suppressTap){
    pinch=null;down=null;
    if(touches.size===0)suppressTap=false;
    return;
  }
  if(down?.id===ev.pointerId){
    const tapped=!cancelled&&!down.moved;
    down=null;if(tapped)tapTile(cellFromPointer(ev));
  }
}
canvas.addEventListener('pointerup',ev=>finishPointer(ev,false));
canvas.addEventListener('pointercancel',ev=>finishPointer(ev,true));
el('fitWorld').addEventListener('click',fitWorld);
canvas.addEventListener('wheel',ev=>{ev.preventDefault();zoom(ev.deltaY<0?2:-2);},{passive:false});
document.addEventListener('keydown',ev=>{
  if((el('endgameDialog') as HTMLDialogElement).open||ev.ctrlKey||ev.metaKey||ev.altKey)return;
  const target=ev.target as HTMLElement;
  if(target.matches('input,textarea,select,button,[contenteditable="true"]'))return;
  const moves:Record<string,Coord>={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    q:{x:-1,y:-1},e:{x:1,y:-1},z:{x:-1,y:1},c:{x:1,y:1}};
  if(ev.key==='Escape'){choosingDestination=false;selectedUnit=null;selectedCity=null;refresh();return;}
  if(ev.key==='+'||ev.key==='='){zoom(3);return;}if(ev.key==='-'){zoom(-3);return;}
  const delta=moves[ev.key];if(!delta||!selectedUnit)return;
  const u=view.ownUnits.find(u=>u.id===selectedUnit);if(!u)return;
  ev.preventDefault();tapTile({x:u.position.x+delta.x,y:u.position.y+delta.y});
});
el('nextRound').addEventListener('click',()=>{dispatch(()=>advanceLabRound(game));uiMessage(`Round ${game.round}. Red has completed its response turn.`);});
el('zoomIn').addEventListener('click',()=>zoom(4));el('zoomOut').addEventListener('click',()=>zoom(-4));
el('recenter').addEventListener('click',()=>focus(view.ownUnits.find(u=>u.id===selectedUnit)?.position??view.ownCities[0]?.position??{x:8,y:25}));
el('exportSave').addEventListener('click',()=>{
  const data=new Blob([exportSave(game)],{type:'application/json'}),url=URL.createObjectURL(data);
  const link=document.createElement('a');link.href=url;link.download=`empirata-lab-round-${game.round}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
el('importSave').addEventListener('click',()=>(el('saveFile') as HTMLInputElement).click());
el('saveFile').addEventListener('change',async()=>{
  const input=el('saveFile') as HTMLInputElement,file=input.files?.[0];if(!file)return;
  pausePlayback();
  try{const loaded=importSave(await file.text());if(loaded.active!=='blue')throw new Error('This lab UI only supports saves during the blue faction turn.');
    resultModal.reset();choosingDestination=false;game=loaded;selectedUnit=null;selectedCity=null;refresh();void saveLocally(game);uiMessage('Saved game imported.');}
  catch(error){uiMessage(error instanceof Error?error.message:'Save could not be loaded.');}finally{input.value='';}
});
function startScenario(kind:'close-quarters'|'classic-lab'|'ai-invasion'|'ai-vs-ai'|'ai-skirmish'):void{
  if(!window.confirm('Start a new test scenario? This will replace the current local autosave. Export JSON first if you want to keep it.'))return;
  pausePlayback();resultModal.reset();observer='blue';spectatorMode='alternate';choosingDestination=false;game=kind==='ai-skirmish'?makeAiVsAiSkirmishLab():kind==='ai-vs-ai'?makeAiVsAiLab():kind==='ai-invasion'?makeAiInvasionLab():kind==='close-quarters'?makeCloseQuartersLab():makeRulesLab();
  selectedUnit=kind==='ai-invasion'||kind==='ai-vs-ai'||kind==='ai-skirmish'?null:'u1';selectedCity=null;refresh();focus(kind==='ai-invasion'?{x:76,y:29}:{x:9,y:25});
  void saveLocally(game).catch(()=>uiMessage('Local save unavailable; export JSON.'));
  uiMessage(game.scenario==='ai-vs-ai'?'Computer vs computer ready. Choose rounds per advance, then use Play or Advance.':kind==='ai-invasion'?'AI Invasion ready: press Next round to watch the Red landing operation.':kind==='close-quarters'?'Close Quarters ready: select a blue unit and tap an adjacent enemy or gold city to attack.':'Classic rules lab reset.');
}
el('newGame').addEventListener('click',()=>startScenario('close-quarters'));
// Close the native Game menu after a scenario or save command.
for(const id of ['newGame','classicGame','invasionGame','aiVsAiGame','aiSkirmishGame','exportSave','importSave']){
  el(id).addEventListener('click',()=>{(el('gameMenu') as HTMLDetailsElement).open=false;});
}
document.addEventListener('pointerdown',event=>{
  const menu=el('gameMenu') as HTMLDetailsElement;
  if(menu.open&&!menu.contains(event.target as Node))menu.open=false;
});
el('classicGame').addEventListener('click',()=>startScenario('classic-lab'));
el('invasionGame').addEventListener('click',()=>startScenario('ai-invasion'));
el('aiSkirmishGame').addEventListener('click',()=>startScenario('ai-skirmish'));
el('aiVsAiGame').addEventListener('click',()=>startScenario('ai-vs-ai'));
el('spectatorSide').addEventListener('change',()=>{
  spectatorMode=(el('spectatorSide') as HTMLSelectElement).value as 'alternate'|'blue'|'red';
  observer=spectatorMode==='alternate'?((game.round-1)%2===0?'blue':'red'):spectatorMode;
  selectedUnit=null;selectedCity=null;spectatorContact=null;spectatorCity=null;refresh();
  uiMessage(spectatorMode==='alternate'?'Automatically alternating the spectator view each round.':`Observing ${observer.toUpperCase()} intelligence. Hidden enemy information remains concealed.`);
});
el('roundSpeed').addEventListener('change',()=>{
  const speed=Number((el('roundSpeed') as HTMLSelectElement).value);
  roundsPerAdvance=[1,10,50,100].includes(speed)?speed:1;
  el('advanceRounds').textContent=`Advance ${roundsPerAdvance} ${roundsPerAdvance===1?'round':'rounds'}`;
  uiMessage(`${roundsPerAdvance} ${roundsPerAdvance===1?'round':'rounds'} selected for the next advance.`);
});
el('advanceRounds').addEventListener('click',()=>startRoundPlayback(false));
el('autoPlay').addEventListener('click',()=>{
  if(playback!==null){pausePlayback();uiMessage(`Paused at round ${game.round}.`);return;}
  startRoundPlayback(true);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePlayback();});
el('resultNewGame').addEventListener('click',()=>startScenario(game.scenario==='ai-vs-ai'?'ai-vs-ai':'close-quarters'));
el('resultReview').addEventListener('click',()=>resultModal.show());
el('endgameExport').addEventListener('click',()=>el('exportSave').click());
el('endgameNewGame').addEventListener('click',()=>el('resultNewGame').click());
el('resultExport').addEventListener('click',()=>el('exportSave').click());
new ResizeObserver(resize).observe(canvas);
async function boot():Promise<void>{
  try{const saved=await loadLocal();if(saved?.active==='blue')game=saved;}catch{uiMessage('Could not load local autosave; use Import JSON if needed.');}
  if(hydrated)return;hydrated=true;selectedUnit=game.units.some(u=>u.id==='u1'&&u.owner==='blue')?'u1':null;refresh();focus(game.scenario==='ai-invasion'?{x:76,y:29}:{x:9,y:25});
  if(game.scenario==='ai-vs-ai')uiMessage('Computer versus computer restored, paused. Press Play to resume.');
  else if(game.scenario==='ai-invasion')uiMessage('AI Invasion restored. Press Next round to watch the invasion.');
  else if(game.scenario==='close-quarters')uiMessage('Select a blue unit, then tap an adjacent red unit or gold city to fight.');
  else uiMessage('Existing saved game restored. Choose Start Close Quarters to try the immediate combat scenario.');
}
void boot();
