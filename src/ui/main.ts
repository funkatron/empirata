import {clampTileSize,fitTileSize,isOverviewTileScale,zoomInForMapTap} from './camera.js';
import {
  exceedsPanThreshold,
  panCamera,
  pinchFrame,
  pinchGestureSample,
  pinchWorldAnchor,
  shouldBeginPinch,
  shouldEmitTap,
  shouldSuppressMultiTouch,
} from './gestures.js';
import {refreshShouldInvalidateKnowledgeLayer} from './observer-map.js';
import {createRenderer} from './render.js';
import type {RenderParams} from './render.js';
import {endgameModal} from './endgame.js';
import {resignModal} from './resign.js';
import {combatSites,referenceTarget,reportsHtml} from './reports.js';
import {knownUnitName,selectedUnitBlock,selectedCityBlock,spectatorUnitBlock,spectatorCityBlock,text} from './inspector-panel.js';
import {applyAiPolicyToMenu,applyRecipeToMenu,currentMenuRecipe,readCampaignAiPolicy,seedSource,syncCampaignClassicGrade,syncCampaignSeedControls} from './game-menu.js';
import {advanceLabRound,endTurn,labRoundPhases,exportSave,getPlayerView,importSave,loadLocal,makeRulesLab,makeCloseQuartersLab,makeAiInvasionLab,makeAiVsAiLab,makeAiVsAiSkirmishLab,makeCampaignMap,mergeSpectatorPlayerViews,
  moveUnit,disembarkArmy,launchFighter,loadShip,unloadShip,runMoveToOrders,saveLocally,selectProduction,setOrder,
  STATS,unitName,cityName,gameOutcome,readableReport,movementAllowance,
  formatMapSeedLine,mapRecipeFromCampaign,parseMapRecipe,randomCampaignSeed,serializeMapRecipe,parseCampaignSeed,
  isCampaignLayout,isMapAlgorithm,isCityDensity,classicResignPendingFor,respondClassicResign,hasBlockingClassicResign,formatAiPolicyLabel,resolveAiPolicy,unitOrderGoals,unitOrderPath} from '../engine/index.js';
import type {AiPolicy,CampaignLayout,CampaignMode,City,CityDensity,Coord,Game,MapAlgorithm,MapRecipe,Unit,UnitType,PlayerView} from '../engine/index.js';

const el=(id:string)=>document.getElementById(id)!;
const canvas=el('map') as HTMLCanvasElement;
const context=canvas.getContext('2d');
if(!context)throw new Error('Canvas 2D is unavailable.');
const ctx=context;
const renderer=createRenderer(canvas,ctx);
const resultModal=endgameModal(el('endgameDialog') as HTMLDialogElement,el('endgameTitle'),el('endgameDetail'),el('endgameInspect') as HTMLButtonElement,canvas);
const resignOffer=resignModal(
  el('resignDialog') as HTMLDialogElement,
  el('resignAccept') as HTMLButtonElement,
  el('resignDecline') as HTMLButtonElement,
  el('resignTitle'),
  canvas,
  accept=>{
    if(!dispatch(()=>respondClassicResign(game,accept),false,null))return;
    undoStack=[];syncUndoButton();
    uiMessage(accept?'Resignation accepted. Cities transferred.':'Resignation declined.');
  },
);
let game:Game=makeCloseQuartersLab();
let observer:'blue'|'red'='blue';
let spectatorMode:'both'|'blue'|'red'='both';
// Observer-only preference; not part of game state or either AI's knowledge.
let revealSpectatorTerrain=true;
let showSpectatorOrderGoals=false;
let pathOverlayKey='';
let pathOverlay:Coord[]|null=null;
let playback:ReturnType<typeof setTimeout>|null=null;
let playbackGeneration=0,roundsPerAdvance=1;
let observerRefreshPending=false;
let openRoundPhases:Array<(state:Game)=>Game>=[];
let openRoundPhaseIndex=0;
/** Co-op CvC must open labRoundPhases on a blue turn after pause or partial dispatch. */
function normalizeSpectatorPlaybackTurn():void {
  if(game.scenario!=='ai-vs-ai'||gameOutcome(game).state==='finished'||game.active==='blue')return;
  for(let i=0;i<8&&game.active!=='blue';i++){
    try{game=endTurn(game);}catch{break;}
  }
}
function spectatorView():PlayerView {
  if(game.scenario==='ai-vs-ai'&&spectatorMode==='both'){
    return mergeSpectatorPlayerViews(getPlayerView(game,'blue'),getPlayerView(game,'red'));
  }
  const faction=spectatorMode==='red'?'red':'blue';
  return getPlayerView(game,faction);
}
function flushObserverBatch():void {
  if(!observerRefreshPending)return;
  observerRefreshPending=false;
  view=spectatorView();
  if(selectedUnit&&!view.ownUnits.some(u=>u.id===selectedUnit))selectedUnit=null;
  refresh();
  void saveLocally(game).catch(()=>uiMessage('Local save unavailable; use Export JSON.'));
}
/** Finish any in-flight cooperative round so Pause always lands on a blue turn. */
function finishOpenLabRound():void {
  while(openRoundPhaseIndex<openRoundPhases.length){
    const phase=openRoundPhases[openRoundPhaseIndex]!;
    if(!dispatch(()=>phase(game),true))break;
    openRoundPhaseIndex++;
  }
  openRoundPhases=[];openRoundPhaseIndex=0;
  normalizeSpectatorPlaybackTurn();
}
let view:PlayerView=spectatorView();
let selectedUnit:string|null='u1',selectedCity:string|null=null;
let spectatorContact:string|null=null,spectatorCity:string|null=null;
let tileSize=30,cameraX=0,cameraY=0;
let down:{id:number;x:number;y:number;cameraX:number;cameraY:number;moved:boolean}|null=null;
const touches=new Map<number,{x:number;y:number}>();
let pinch:{distance:number;scale:number;worldX:number;worldY:number}|null=null;
let suppressTap=false;
let hydrated=false;
type OrderModeKind='move-to'|'patrol'|'go-direction'|'escort';
/** A visible, cancellable order mode: first tap previews, second tap (or Confirm) commits. */
let orderMode:{kind:OrderModeKind;unitId:string;target:Coord|null}|null=null;
const ORDER_LABEL:Record<OrderModeKind,string>={'move-to':'Move To','patrol':'Patrol','go-direction':'Go Direction','escort':'Escort'};
const ORDER_PROMPT:Record<OrderModeKind,string>={
  'move-to':'tap a destination',
  'patrol':'tap the far end of the patrol route',
  'go-direction':'tap a square next to the unit to pick a bearing',
  'escort':'tap a friendly unit to escort',
};
let lastInspectorKey='';
/** Undo history for this turn's player actions. Cleared by any random draw (combat) or round change. */
type UndoEntry={game:Game;label:string;selectedUnit:string|null;selectedCity:string|null};
let undoStack:UndoEntry[]=[];
/** The game a New game / scenario start replaced, restorable with Undo until the next action. */
let replacedGame:UndoEntry|null=null;
/** Combat reported from this event id onward is marked on the map. */
let combatMarkersSince=Number.MAX_SAFE_INTEGER;
let lastEventsKey='';
const stackDialog=el('stackDialog') as HTMLDialogElement;
const gameMenuDialog=el('gameMenuDialog') as HTMLDialogElement;
function uiMessage(message:string):void {el('toast').textContent=message;}
const colors={blue:'#68c4f1',red:'#f47c73',green:'#a4dc8b',neutral:'#e2c37c'};
function setMapActivity(title:string|null,detail=''):void {
  const panel=el('mapBusy');
  if(!title){panel.hidden=true;return;}
  panel.hidden=false;
  el('mapBusyText').textContent=title;
  el('mapBusyDetail').textContent=detail;
}
function spectatorPhaseMessage(phaseIndex:number):string {
  if(game.scenario==='ai-vs-ai'){
    if(phaseIndex===0)return 'Blue computer moving';
    if(phaseIndex===1)return 'Production & upkeep';
    if(phaseIndex===2)return 'Red computer moving';
    return 'Closing round';
  }
  if(phaseIndex===0)return 'Production & upkeep';
  if(phaseIndex===1)return 'Computer moving';
  return 'Closing round';
}
function overlayUnitId():string|null {
  if(game.scenario!=='ai-vs-ai')return selectedUnit;
  return spectatorContact??selectedUnit;
}
function pathForSelection():Coord[]|null {
  const id=overlayUnitId();
  if(!id)return null;
  const unit=game.units.find(u=>u.id===id&&!u.aboard);
  if(!unit)return null;
  const key=`${game.round}|${id}|${unit.position.x},${unit.position.y}|${JSON.stringify(unit.order)}`;
  if(key!==pathOverlayKey){pathOverlayKey=key;pathOverlay=unitOrderPath(game,unit);}
  return pathOverlay;
}
function drawPathOverlay(path:Coord[],color:string):void {
  if(path.length<2)return;
  ctx.save();
  ctx.strokeStyle=color;
  ctx.globalAlpha=.88;
  ctx.lineWidth=Math.max(2,tileSize*.08);
  ctx.setLineDash([Math.max(4,tileSize*.14),Math.max(3,tileSize*.1)]);
  ctx.beginPath();
  for(let i=0;i<path.length;i++){
    const p=path[i]!;
    const x=p.x*tileSize+tileSize/2-cameraX,y=p.y*tileSize+tileSize/2-cameraY;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.restore();
}
function drawGoalMarker(px:number,py:number,color:string,secondary=false):void {
  const cx=px+tileSize/2,cy=py+tileSize/2,r=tileSize*(secondary?.18:.24);
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=secondary?1.6:2.2;
  ctx.globalAlpha=secondary?.72:1;
  ctx.beginPath();
  ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r,cy);ctx.lineTo(cx,cy+r);ctx.lineTo(cx-r,cy);
  ctx.closePath();ctx.stroke();
  ctx.restore();
}
function paintOrderOverlays(displayUnits:Array<{id:string;owner:'blue'|'red'|'green'}>):void {
  if(game.scenario!=='ai-vs-ai')return;
  const goalsOn=showSpectatorOrderGoals;
  const path=pathForSelection();
  const pathId=overlayUnitId();
  if(goalsOn){
    for(const seen of displayUnits){
      const unit=game.units.find(u=>u.id===seen.id&&!u.aboard);
      if(!unit)continue;
      const goals=unitOrderGoals(game,unit);
      const color=colors[unit.owner]??'#e2c37c';
      goals.forEach((goal,i)=>{
        if(i>0&&pathId===unit.id&&path?.at(-1)&&goal.x===path.at(-1)!.x&&goal.y===path.at(-1)!.y)return;
        drawGoalMarker(goal.x*tileSize-cameraX,goal.y*tileSize-cameraY,color,i>0);
      });
    }
  }
  if(path&&pathId){
    const owner=game.units.find(u=>u.id===pathId)?.owner??'blue';
    drawPathOverlay(path,colors[owner]??'#e2c37c');
    if(!goalsOn){
      const goals=unitOrderGoals(game,game.units.find(u=>u.id===pathId)!);
      const color=colors[owner]??'#e2c37c';
      goals.slice(0,1).forEach(g=>drawGoalMarker(g.x*tileSize-cameraX,g.y*tileSize-cameraY,color));
    }
  }
}
/** Player units still able to move with no standing order, then cities producing nothing. */
function awaitingItems():Array<{unit?:string;city?:string;position:Coord}> {
  if(game.scenario==='ai-vs-ai'||gameOutcome(game).state==='finished')return [];
  const units=view.ownUnits.filter(u=>!u.aboard&&u.order.kind==='none'&&movementAllowance(u)-u.spent>0)
    .map(u=>({unit:u.id,position:u.position}));
  const cities=view.ownCities.filter(c=>!c.production).map(c=>({city:c.id,position:c.position}));
  return [...units,...cities];
}
function nextAwaiting():void {
  if(game.scenario==='ai-vs-ai')return;
  const items=awaitingItems();
  if(!items.length){uiMessage('Every unit has orders and every city is producing. Press Next round when ready.');return;}
  cancelOrderMode();
  const current=items.findIndex(i=>i.unit?i.unit===selectedUnit:i.city===selectedCity);
  const item=items[(current+1)%items.length]!;
  selectedUnit=item.unit??null;selectedCity=item.city??null;spectatorContact=null;spectatorCity=null;
  focus(item.position);refresh();
}
function paintPlayerMarkers():void {
  if(game.scenario==='ai-vs-ai')return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const visible=(p:Coord)=>{const x=p.x*tileSize-cameraX,y=p.y*tileSize-cameraY;return x>-tileSize&&y>-tileSize&&x<w&&y<h;};
  ctx.save();
  // Idle cities: dashed gold ring.
  ctx.strokeStyle='#f0dd9b';ctx.lineWidth=Math.max(1.5,tileSize*.06);ctx.setLineDash([Math.max(3,tileSize*.12),Math.max(2,tileSize*.08)]);
  for(const city of view.ownCities){
    if(city.production||!visible(city.position))continue;
    const x=city.position.x*tileSize-cameraX,y=city.position.y*tileSize-cameraY,inset=Math.max(1,tileSize*.04);
    ctx.strokeRect(x+inset,y+inset,tileSize-2*inset,tileSize-2*inset);
  }
  // Recent combat: red burst in the tile corner.
  ctx.setLineDash([]);ctx.strokeStyle='#ff6b5e';ctx.lineWidth=Math.max(1.5,tileSize*.07);
  for(const site of combatSites(view,game,combatMarkersSince)){
    if(!visible(site))continue;
    const cx=site.x*tileSize-cameraX+tileSize*.8,cy=site.y*tileSize-cameraY+tileSize*.2,r=Math.max(3,tileSize*.16);
    ctx.beginPath();
    for(let i=0;i<4;i++){const a=i*Math.PI/4;ctx.moveTo(cx-Math.cos(a)*r,cy-Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
    ctx.stroke();
  }
  ctx.restore();
}
function buildRenderParams():RenderParams{
  const displayUnits=[...view.enemies.map(e=>({id:e.id,kind:e.kind,position:e.position,owner:e.owner,stale:e.stale})),
    ...view.ownUnits.filter(u=>!u.aboard).map(u=>({id:u.id,kind:u.kind,position:u.position,owner:u.owner,stale:false}))];
  return {view,game,tileSize,cameraX,cameraY,revealSpectatorTerrain,selectedUnit,selectedCity,spectatorContact,spectatorCity,
    postPaint:()=>{paintOrderOverlays(displayUnits);paintPlayerMarkers();paintOrderPreview();}};
}
function invalidateMapLayer():void{renderer.invalidateMapLayer();}
function paint():void{renderer.paint(buildRenderParams());}
function schedulePaint():void{renderer.schedulePaint(buildRenderParams());}
function beginZoomGesture():void{renderer.beginZoomGesture(tileSize);}
function publishMapPaintProbe():void {
  // observer-batching.mjs evaluates a slice of this file in vm without `window`.
  if(typeof window==='undefined')return;
  (window as Window&{empirataMapPaintProbe?:unknown}).empirataMapPaintProbe={
    stats:()=>renderer.mapPaintStats,
    reset(){renderer.resetPaintStats();},
    paintOnce:()=>paint(),
    refreshOnce:()=>refresh(),
    invalidateAndPaint(){invalidateMapLayer();paint();},
    setReveal(enabled:boolean){
      revealSpectatorTerrain=enabled;
      (el('spectatorTerrain') as HTMLInputElement).checked=enabled;
      invalidateMapLayer();paint();
    },
    /** Playwright smoke: select a map cell through the same tap path as the UI (incl. overview zoom). */
    selectMapCell(pos:Coord){
      for(let attempt=0;attempt<4;attempt++){
        tapTile(pos,true);
        if(el('inspector').querySelector('.selection-title'))return;
      }
    },
  };
}
publishMapPaintProbe();
function pausePlayback():void {
  playbackGeneration++;
  if(playback!==null){clearTimeout(playback);playback=null;}
  finishOpenLabRound();
  const button=document.getElementById('autoPlay');if(button)button.textContent='▶ Play';
  (el('advanceRounds') as HTMLButtonElement).disabled=gameOutcome(game).state==='finished';
  (el('nextRound') as HTMLButtonElement).disabled=gameOutcome(game).state==='finished';
  setMapActivity(null);
  flushObserverBatch();
}
/** Yield between AI phases and rounds so painting, Pause and scenario changes
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
    setMapActivity('Advancing rounds',`${completed+1} / ${target}`);
  };
  progress();
  const tick=()=>{
    if(generation!==playbackGeneration)return;
    if(completed===0&&openRoundPhaseIndex===0){target=roundsPerAdvance;progress();}
    if(game.scenario!=='ai-vs-ai'){pausePlayback();return;}
    if(openRoundPhaseIndex===0){
      normalizeSpectatorPlaybackTurn();
      try{openRoundPhases=labRoundPhases(game);}
      catch(error){
        uiMessage(error instanceof Error?error.message:'Could not advance spectator round.');
        pausePlayback();
        return;
      }
      if(!openRoundPhases.length){pausePlayback();return;}
    }
    const phase=openRoundPhases[openRoundPhaseIndex]!;
    setMapActivity(spectatorPhaseMessage(openRoundPhaseIndex),`${completed+1} / ${target} · round ${game.round}`);
    if(!dispatch(()=>phase(game),true)){
      uiMessage('Playback paused: a computer turn step failed.');
      pausePlayback();
      return;
    }
    openRoundPhaseIndex++;
    if(openRoundPhaseIndex<openRoundPhases.length){playback=setTimeout(tick,0);return;}
    openRoundPhases=[];openRoundPhaseIndex=0;completed++;progress();
    if(gameOutcome(game).state==='finished'){pausePlayback();return;}
    if(completed===target){
      observerRefreshPending=true;
      flushObserverBatch();
      if(!repeat){pausePlayback();uiMessage(`Advanced ${completed} ${completed===1?'round':'rounds'} to round ${game.round}.`);return;}
      completed=0;
      progress();
      playback=setTimeout(tick,750);
    }else playback=setTimeout(tick,0);
  };
  playback=setTimeout(tick,repeat?750:0);
}
function dispatch(operation:()=>Game,deferObserverRefresh=false,undoLabel:string|null='last action'):boolean {
  if(gameOutcome(game).state==='finished'){uiMessage('Game over. Inspect the map, export the save, or start a new game.');return false;}
  try {
    const before=game.nextEventId;
    const recordUndo=undoLabel!==null&&!deferObserverRefresh&&game.scenario!=='ai-vs-ai';
    const snapshot=recordUndo?structuredClone(game):null;
    const draws=recordUndo?game.rng.draws:0;
    game=operation();
    if(snapshot){
      replacedGame=null;
      if(game.rng.draws!==draws)undoStack=[];
      else{undoStack.push({game:snapshot,label:undoLabel!,selectedUnit,selectedCity});if(undoStack.length>30)undoStack.shift();}
      syncUndoButton();
    }
    if(deferObserverRefresh){observerRefreshPending=true;return true;}
    view=spectatorView();
    if(selectedUnit&&!view.ownUnits.some(u=>u.id===selectedUnit))selectedUnit=null;
    refresh();
    const result=view.events.filter(e=>e.id>=before&&e.kind==='combat').at(-1);
    if(result){
      if(combatMarkersSince>before)combatMarkersSince=before;
      uiMessage(`${readableReport(result.message,[...view.ownUnits,...view.enemies],game.cities)} Combat cannot be undone.`);
    }
    void saveLocally(game).catch(()=>uiMessage('Local save unavailable; use Export JSON.'));
    return true;
  } catch(error) {uiMessage(error instanceof Error?error.message:String(error));return false;}
}
function syncUndoButton():void {
  const button=el('undoButton') as HTMLButtonElement;
  const next=undoStack.at(-1)??replacedGame;
  button.disabled=!next||gameOutcome(game).state==='finished'&&!replacedGame;
  const label=next?(undoStack.length?`Undo ${next.label}`:'Undo: restore the previous game'):'Nothing to undo';
  button.title=label;button.setAttribute('aria-label',label);
}
function undo():void {
  const entry=undoStack.pop()??replacedGame;
  if(!entry){uiMessage('Nothing to undo.');return;}
  const restoringGame=entry===replacedGame;
  replacedGame=null;
  pausePlayback();
  orderMode=null;
  game=entry.game;selectedUnit=entry.selectedUnit;selectedCity=entry.selectedCity;spectatorContact=null;spectatorCity=null;
  if(restoringGame){resultModal.reset();observer='blue';spectatorMode='both';invalidateMapLayer();}
  refresh();syncUndoButton();
  void saveLocally(game).catch(()=>uiMessage('Local save unavailable; use Export JSON.'));
  uiMessage(restoringGame?'Previous game restored.':`Undid ${entry.label}.`);
}
/** Keep the outgoing game so a New game / scenario start can be undone (replaces confirm dialogs). */
function rememberReplacedGame():void {
  replacedGame={game,label:'new game',selectedUnit,selectedCity};
  undoStack=[];
  combatMarkersSince=Number.MAX_SAFE_INTEGER;
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
/** At fit-world scale, zoom toward the tapped cell instead of imprecise selection. */
function zoomToCellForTap(pos:Coord):boolean{
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!isOverviewTileScale(tileSize,w,h,game.width,game.height))return false;
  const old=tileSize;
  tileSize=zoomInForMapTap(tileSize,w,h,game.width,game.height);
  cameraX=(cameraX+w/2)*(tileSize/old)-w/2;
  cameraY=(cameraY+h/2)*(tileSize/old)-h/2;
  cameraX=pos.x*tileSize-w/2;
  cameraY=pos.y*tileSize-h/2;
  clamp();paint();
  uiMessage('Zoomed in on that area — tap again to select a unit or city.');
  return true;
}
function zoom(change:number):void {
  const old=tileSize,w=canvas.clientWidth,h=canvas.clientHeight;
  tileSize=clampTileSize(tileSize+change,w,h,game.width,game.height);
  cameraX=(cameraX+w/2)*(tileSize/old)-w/2;
  cameraY=(cameraY+h/2)*(tileSize/old)-h/2;
  clamp();schedulePaint();
}
function fitWorld():void {
  tileSize=fitTileSize(canvas.clientWidth,canvas.clientHeight,game.width,game.height);
  cameraX=(game.width*tileSize-canvas.clientWidth)/2;
  cameraY=(game.height*tileSize-canvas.clientHeight)/2;
  clamp();paint();
}
window.addEventListener('empirata-terrain-ready',()=>{invalidateMapLayer();paint();});
function cellFromPointer(ev:PointerEvent):Coord {
  const rect=canvas.getBoundingClientRect();
  return {x:Math.floor((ev.clientX-rect.left+cameraX)/tileSize),y:Math.floor((ev.clientY-rect.top+cameraY)/tileSize)};
}
/** Keep a tapped spectator selection visible in the sidebar on iPad and desktop.
 * Only user-initiated selection scrolls; background turns never move the panel.
 */
function revealSpectatorInspector():void {
  const inspector=el('inspector').closest('.card') as HTMLElement|null;
  const sidebar=el('inspector').closest('.sidebar') as HTMLElement|null;
  if(!inspector||!sidebar)return;
  const item=inspector.getBoundingClientRect(),region=sidebar.getBoundingClientRect();
  // If the inspector header is already visible, avoid a disruptive jump.
  if(item.top>=region.top&&item.top<region.bottom-44)return;
  sidebar.scrollTop+=item.top-region.top-8;
}
function showCityStack(pos:Coord):boolean {
  if(pos.x<0||pos.y<0||pos.x>=view.width||pos.y>=view.height)return false;
  const atTile=(unit:{position:Coord})=>unit.position.x===pos.x&&unit.position.y===pos.y;
  const cityAtTile=()=>view.cells[pos.y*view.width+pos.x]?.city;
  if(!cityAtTile())return false;
  if(playback!==null)pausePlayback();
  const city=cityAtTile();
  if(!city)return false;
  const own=view.ownUnits.filter(u=>!u.aboard&&atTile(u));
  const enemies=view.enemies.filter(u=>!u.stale&&atTile(u));
  if(!own.length&&!enemies.length)return false;

  const list=el('stackChoices');
  list.replaceChildren();
  el('stackTitle').textContent=cityName(city.id);
  const addChoice=(label:string,choose:()=>void)=>{
    const button=document.createElement('button');
    button.type='button';button.textContent=label;
    button.addEventListener('click',()=>{stackDialog.close();choose();});
    list.append(button);
  };
  const select=(unit:string|null,contact:string|null,cityId:string|null)=>{
    selectedUnit=unit;spectatorContact=contact;
    selectedCity=view.ownCities.some(c=>c.id===cityId)?cityId:null;
    spectatorCity=selectedCity?null:cityId;
    refresh();
    if(game.scenario==='ai-vs-ai')revealSpectatorInspector();
  };
  addChoice(`Inspect ${cityName(city.id)} · ${city.owner??'neutral'} city`,()=>select(null,null,city.id));
  for(const unit of own) addChoice(`${unitName(unit)} · ${STATS[unit.kind].name}`,()=>select(unit.id,null,null));
  for(const unit of enemies) addChoice(`${unitName(unit)} · ${STATS[unit.kind].name} · ${unit.owner}`,()=>select(null,unit.id,null));
  const active=view.ownUnits.find(u=>u.id===selectedUnit);
  if(game.scenario!=='ai-vs-ai'&&!own.length&&active&&city.owner!==observer&&
    Math.max(Math.abs(active.position.x-pos.x),Math.abs(active.position.y-pos.y))===1){
    addChoice(`Attack with ${unitName(active)}`,()=>tapTile(pos,false));
  }
  stackDialog.showModal();
  return true;
}
function syncOrderModeUi():void {
  const banner=el('orderBanner');
  const unit=orderMode?view.ownUnits.find(u=>u.id===orderMode!.unitId):undefined;
  if(!orderMode||!unit){banner.hidden=true;}
  else{
    banner.hidden=false;
    const label=ORDER_LABEL[orderMode.kind];
    const t=orderMode.target;
    el('orderBannerText').textContent=t
      ?`${label} → ${t.x}, ${t.y}. Tap it again or press Confirm.`
      :`${label} for ${unitName(unit)}: ${ORDER_PROMPT[orderMode.kind]}.`;
    (el('orderConfirm') as HTMLButtonElement).disabled=!t;
  }
  const pressed:Record<string,OrderModeKind>={moveToButton:'move-to',directionButton:'go-direction',patrolButton:'patrol',escortButton:'escort'};
  for(const [id,kind] of Object.entries(pressed)){
    const button=document.getElementById(id);
    if(button)button.setAttribute('aria-pressed',String(orderMode?.kind===kind));
  }
}
function startOrderMode(kind:OrderModeKind,unitId:string):void {
  if(orderMode?.kind===kind&&orderMode.unitId===unitId){cancelOrderMode();return;}
  orderMode={kind,unitId,target:null};
  syncOrderModeUi();schedulePaint();
}
function cancelOrderMode():void {
  if(!orderMode)return;
  orderMode=null;syncOrderModeUi();schedulePaint();
}
/** The order the current mode would give, for preview and commit. */
function pendingOrder():Unit['order']|null {
  if(!orderMode?.target)return null;
  const unit=view.ownUnits.find(u=>u.id===orderMode!.unitId);
  if(!unit)return null;
  const pos=orderMode.target,origin=unit.position;
  if(orderMode.kind==='escort'){
    const target=view.ownUnits.find(u=>u.id!==unit.id&&!u.aboard&&u.position.x===pos.x&&u.position.y===pos.y);
    return target?{kind:'escort',targetId:target.id}:null;
  }
  if(orderMode.kind==='go-direction')return {kind:'go-direction',direction:{x:Math.sign(pos.x-origin.x),y:Math.sign(pos.y-origin.y)}};
  if(orderMode.kind==='patrol')return {kind:'patrol',from:{...origin},to:{...pos},outbound:true};
  return {kind:'move-to',destination:{...pos}};
}
function commitOrderMode():void {
  const mode=orderMode,order=pendingOrder();
  if(!mode||!order)return;
  orderMode=null;syncOrderModeUi();
  const name=knownUnitName(view,mode.unitId);
  if(dispatch(()=>runMoveToOrders(setOrder(game,mode.unitId,order)),false,`${ORDER_LABEL[mode.kind]} for ${name}`))
    uiMessage(`${ORDER_LABEL[mode.kind]} order given to ${name}.`);
}
function paintOrderPreview():void {
  const order=pendingOrder();
  if(!orderMode||!order)return;
  const unit=view.ownUnits.find(u=>u.id===orderMode!.unitId);
  if(!unit)return;
  const t=orderMode.target!;
  let path:Coord[]|null=null;
  if(order.kind==='go-direction'){
    path=[unit.position];
    for(let i=1;i<=4;i++)path.push({x:unit.position.x+order.direction.x*i,y:unit.position.y+order.direction.y*i});
  }else if(order.kind!=='escort'){
    try{path=unitOrderPath(game,{...unit,order});}catch{path=null;}
    if(!path)path=[unit.position,t];
  }
  if(path)drawPathOverlay(path,'#f0dd9b');
  drawGoalMarker(t.x*tileSize-cameraX,t.y*tileSize-cameraY,'#f0dd9b');
}
function tapTile(pos:Coord,allowPicker=true):void {
  if(allowPicker&&zoomToCellForTap(pos))return;
  if(game.scenario==='ai-vs-ai'){
    if(allowPicker&&showCityStack(pos))return;
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
    refresh();
    if(chosen)revealSpectatorInspector();
    return;
  }
  if(orderMode){
    if(pos.x<0||pos.y<0||pos.x>=game.width||pos.y>=game.height)return;
    const unit=view.ownUnits.find(u=>u.id===orderMode!.unitId);
    if(!unit){cancelOrderMode();return;}
    if(orderMode.kind==='escort'&&!view.ownUnits.some(u=>u.id!==unit.id&&!u.aboard&&u.position.x===pos.x&&u.position.y===pos.y)){
      uiMessage('Escort: tap a different friendly unit.');return;
    }
    if(orderMode.kind==='go-direction'&&pos.x===unit.position.x&&pos.y===unit.position.y){
      uiMessage('Go Direction: tap a square next to the unit, not the unit itself.');return;
    }
    if(orderMode.target&&orderMode.target.x===pos.x&&orderMode.target.y===pos.y){commitOrderMode();return;}
    orderMode.target={...pos};
    syncOrderModeUi();schedulePaint();
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
  if(allowPicker&&showCityStack(pos))return;
  spectatorContact=null;spectatorCity=null;
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
      if(dispatch(()=>moveUnit(game,selectedUnit!,pos),false,`move of ${unitName(unit)}`)&&targetCity){
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
function factionTotals(faction:'blue'|'red'):{cities:number;units:number} {
  let cities=0,units=0;
  for(const city of game.cities)if(city.owner===faction)cities++;
  for(const unit of game.units)if(unit.owner===faction)units++;
  return {cities,units};
}
function bindInspectorControls(unit:Unit|undefined,city:City|undefined):void {
  const inspector=el('inspector');
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
  for(const [button,kind] of [['moveToButton','move-to'],['directionButton','go-direction'],['patrolButton','patrol'],['escortButton','escort']] as const){
    document.getElementById(button)?.addEventListener('click',()=>{if(unit)startOrderMode(kind,unit.id);});
  }
  document.getElementById('homeButton')?.addEventListener('click',()=>{
    if(unit&&dispatch(()=>runMoveToOrders(setOrder(game,unit.id,{kind:'go-home'}))))
      uiMessage(`${unitName(unit)} returning to a friendly city.`);
  });
  const productionSelect=document.getElementById('productionSelect') as HTMLSelectElement | null;
  if(productionSelect&&city)productionSelect.addEventListener('change',()=>{
    if(productionSelect.value)dispatch(()=>selectProduction(game,city.id,productionSelect.value as UnitType),false,`production change in ${cityName(city.id)}`);
  });
  for(const [button,kind] of [['sentryButton','sentry'],['clearButton','none'],['skipButton','skip']] as const){
    const target=document.getElementById(button);
    if(target&&unit)target.addEventListener('click',()=>dispatch(()=>setOrder(game,unit.id,{kind}),false,`order for ${unitName(unit)}`));
  }
}
function refresh():void {
  view=spectatorView();
  if(refreshShouldInvalidateKnowledgeLayer(game.scenario,revealSpectatorTerrain)){
    renderer.invalidateKnowledgeLayer(game.scenario,revealSpectatorTerrain);
  }
  if(spectatorContact&&!view.enemies.some(u=>u.id===spectatorContact&&!u.stale))spectatorContact=null;
  if(spectatorCity&&!view.cells.some(c=>c.city?.id===spectatorCity))spectatorCity=null;
  el('aiSpectator').hidden=game.scenario!=='ai-vs-ai';
  el('spectatorCard').hidden=game.scenario!=='ai-vs-ai';
  el('viewFaction').textContent=
    game.scenario==='ai-vs-ai'&&spectatorMode==='both'?'Both':spectatorMode==='red'?'Red':'Blue';
  (el('spectatorSide') as HTMLSelectElement).value=spectatorMode;
  (el('spectatorTerrain') as HTMLInputElement).checked=revealSpectatorTerrain;
  (el('spectatorOrderGoals') as HTMLInputElement).checked=showSpectatorOrderGoals;
  if(game.scenario==='ai-vs-ai'){
    el('spectatorNow').textContent=
      spectatorMode==='both'
        ?`Blue + Red intelligence · Round ${game.round}`
        :`Currently viewing ${spectatorMode.toUpperCase()} intelligence · Round ${game.round}`;
    // Own totals only; never build full PlayerViews just for scorecards.
    const blue=factionTotals('blue'),red=factionTotals('red');
    el('spectatorBlue').textContent=`${blue.cities} cities · ${blue.units} units`;
    el('spectatorRed').textContent=`${red.cities} cities · ${red.units} units`;
  }
  el('round').textContent=`ROUND ${game.round}`;
  document.body.classList.toggle('cvc',game.scenario==='ai-vs-ai');
  const awaiting=awaitingItems();
  const awaitingUnits=awaiting.filter(i=>i.unit).length,idleCities=awaiting.length-awaitingUnits;
  el('awaitingCount').textContent=game.scenario==='ai-vs-ai'?'—':String(awaiting.length);
  (el('nextUnit') as HTMLButtonElement).disabled=!awaiting.length;
  el('nextUnit').setAttribute('aria-label',`Next unit or city awaiting orders: ${awaitingUnits} units, ${idleCities} cities`);
  el('nextUnit').title=`${awaitingUnits} ${awaitingUnits===1?'unit':'units'} without orders · ${idleCities} idle ${idleCities===1?'city':'cities'} (N)`;
  syncOrderModeUi();syncUndoButton();
  el('cityCount').textContent=String(view.ownCities.length);
  el('unitCount').textContent=String(view.ownUnits.length);
  const policyBanner=game.campaignMap?` · ${formatAiPolicyLabel(resolveAiPolicy(game)).toUpperCase()}`:'';
  el('scenarioName').title=game.campaignMap?`${game.campaignMap.layout} · ${game.campaignMap.algorithm??'ellipse-v1'} · ${game.campaignMap.density??'sparse'} · seed ${game.campaignMap.seed}${policyBanner}`:'';
  el('scenarioName').textContent=game.campaignMap?`${game.scenario==='ai-vs-ai'?'COMPUTER vs COMPUTER':'CAMPAIGN'} · ${game.campaignMap.layout.toUpperCase()} · SEED ${game.campaignMap.seed}${policyBanner}`:game.scenario==='ai-vs-ai'?'COMPUTER vs COMPUTER · EXPERIMENTAL':game.scenario==='ai-invasion'?'AI INVASION · DEMONSTRATION':game.scenario==='close-quarters'?'CLOSE QUARTERS · PLAYABLE':'CLASSIC RULES LAB';
  el('threatCount').textContent=String(view.enemies.filter(u=>!u.stale).length);
  const unit=view.ownUnits.find(u=>u.id===selectedUnit);
  const city=view.ownCities.find(c=>c.id===selectedCity);
  const inspector=el('inspector');
  const inspectorKey=[
    game.scenario,game.round,selectedUnit,selectedCity,spectatorContact,spectatorCity,
    unit?`${unit.spent}|${unit.damage}|${unit.fuel}|${unit.order.kind}|${unit.position.x},${unit.position.y}`:'',
    city?`${city.production}|${city.progress}|${city.firstCycle}`:'',
  ].join('|');
  if(inspectorKey!==lastInspectorKey){
    lastInspectorKey=inspectorKey;
    if(unit)inspector.innerHTML=game.scenario==='ai-vs-ai'?spectatorUnitBlock(view,unit):selectedUnitBlock(view,unit);
    else if(city)inspector.innerHTML=game.scenario==='ai-vs-ai'?spectatorCityBlock(city):selectedCityBlock(game,city);
    else if(spectatorContact){
      const enemy=view.enemies.find(u=>u.id===spectatorContact&&!u.stale);
      inspector.innerHTML=enemy?
        `<div class="selection-title">${text(unitName(enemy))}</div><div class="subtle">${text(STATS[enemy.kind].name)}</div>
        <div class="subtle">${text(enemy.owner)} · ${enemy.position.x}, ${enemy.position.y}</div>
        <p class="stat-note">Visible enemy contact. Additional details are not available to this faction.</p>`:
        '<p>Enemy contact no longer visible.</p>';
    }
    else if(spectatorCity){
      const intel=view.cells.find(c=>c.city?.id===spectatorCity)?.city;
      inspector.innerHTML=intel?
        `<div class="selection-title">${text(cityName(intel.id))}</div>
        <div class="subtle">Known owner: ${text(intel.owner??'Neutral')}</div>
        <p class="stat-note">Remembered city intelligence. Production is not visible.</p>`:
        '<p>City intelligence unavailable.</p>';
    }
    else inspector.innerHTML=game.scenario==='ai-vs-ai'?'<p>Tap a unit or city on the map to inspect it.</p>':'<p>Tap a blue unit or city, or press Next.</p>';
    bindInspectorControls(unit,city);
  }
  const eventsKey=view.events.map(e=>e.id).join(',');
  if(eventsKey!==lastEventsKey){
    lastEventsKey=eventsKey;
    el('events').innerHTML=reportsHtml(view,game);
  }
  const outcome=gameOutcome(game),finished=outcome.state==='finished';
  el('gameResult').hidden=!finished;
  if(finished){
    el('gameResultTitle').textContent=outcome.winner===null?'Draw':game.scenario==='ai-vs-ai'?`${outcome.winner.toUpperCase()} wins`:outcome.winner==='blue'?'You won':'You lost';
    el('gameResultDetail').textContent=outcome.winner===null?'No faction has any cities or surviving units.':'Only the winning faction has cities or surviving units.';
  }
  resultModal.update(finished,el('gameResultTitle').textContent??'Game over',`${el('gameResultDetail').textContent} Finished in round ${game.round}. Inspect the final map, export this game, or start a new one.`);
  const resignBlocked=hasBlockingClassicResign(game)&&game.scenario!=='ai-vs-ai';
  const pendingComputer=classicResignPendingFor(game,observer);
  if(resignBlocked&&pendingComputer){
    const label=game.players.find(p=>p.id===pendingComputer)?.label??pendingComputer.toUpperCase();
    resignOffer.open(label);
  }else resignOffer.close();
  for(const id of ['autoPlay','advanceRounds','nextRound']) (el(id) as HTMLButtonElement).disabled=finished||resignBlocked;
  if(finished)inspector.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select').forEach(control=>{if(!control.classList.contains('cargoButton'))control.disabled=true;});
  paint();
}
function pinchPoints(){if(touches.size<2)return null;const [a,b]=[...touches.values()];return pinchGestureSample(a!,b!);}
function beginPinch():void {
  const p=pinchPoints();if(!p)return;
  const rect=canvas.getBoundingClientRect();
  const anchor=pinchWorldAnchor(p.x,p.y,rect.left,rect.top,cameraX,cameraY,tileSize);
  pinch={distance:p.distance,scale:tileSize,worldX:anchor.worldX,worldY:anchor.worldY};
  beginZoomGesture();
  suppressTap=true;down=null;
}
canvas.addEventListener('pointerdown',ev=>{
  if(ev.pointerType==='mouse'&&ev.button!==0)return;
  canvas.setPointerCapture(ev.pointerId);
  touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(shouldBeginPinch(touches.size)){beginPinch();return;}
  if(shouldSuppressMultiTouch(touches.size)){suppressTap=true;down=null;return;}
  if(suppressTap)return;
  down={id:ev.pointerId,x:ev.clientX,y:ev.clientY,cameraX,cameraY,moved:false};
  canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',ev=>{
  if(!touches.has(ev.pointerId))return;
  touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(pinch&&touches.size===2){
    const p=pinchPoints()!,rect=canvas.getBoundingClientRect();
    const frame=pinchFrame({
      worldX:pinch.worldX,worldY:pinch.worldY,
      startScale:pinch.scale,startDistance:pinch.distance,
      midX:p.x,midY:p.y,currentDistance:p.distance,
      rectLeft:rect.left,rectTop:rect.top,
      viewW:canvas.clientWidth,viewH:canvas.clientHeight,
      worldW:game.width,worldH:game.height,
    });
    tileSize=frame.tileSize;cameraX=frame.cameraX;cameraY=frame.cameraY;
    clamp();schedulePaint();return;
  }
  if(!down||down.id!==ev.pointerId)return;
  const dx=ev.clientX-down.x,dy=ev.clientY-down.y;
  if(exceedsPanThreshold(dx,dy))down.moved=true;
  if(down.moved){const next=panCamera(down.cameraX,down.cameraY,dx,dy);cameraX=next.x;cameraY=next.y;clamp();schedulePaint();}
});
function finishPointer(ev:PointerEvent,cancelled:boolean):void {
  if(!touches.has(ev.pointerId))return;
  touches.delete(ev.pointerId);
  if(pinch||suppressTap){
    const endedPinch=!!pinch;
    pinch=null;down=null;
    if(touches.size===0)suppressTap=false;
    if(endedPinch)renderer.commitZoomGesture();
    return;
  }
  if(down?.id===ev.pointerId){
    const tapped=shouldEmitTap({cancelled,moved:down.moved,suppressTap:false,endingPinch:false});
    down=null;if(tapped)tapTile(cellFromPointer(ev));
  }
}
canvas.addEventListener('pointerup',ev=>finishPointer(ev,false));
canvas.addEventListener('pointercancel',ev=>finishPointer(ev,true));
el('fitWorld').addEventListener('click',fitWorld);
canvas.addEventListener('wheel',ev=>{ev.preventDefault();beginZoomGesture();zoom(ev.deltaY<0?2:-2);},{passive:false});
document.addEventListener('keydown',ev=>{
  if(stackDialog.open||resignOffer.isOpen()||(el('endgameDialog') as HTMLDialogElement).open||gameMenuDialog.open||ev.altKey)return;
  const target=ev.target as HTMLElement;
  if(target.matches('input,textarea,select,[contenteditable="true"]'))return;
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='z'&&!ev.shiftKey){ev.preventDefault();undo();return;}
  if(ev.ctrlKey||ev.metaKey)return;
  if(target.matches('button')&&ev.key!=='Escape')return;
  if(ev.key==='u'){undo();return;}
  if(ev.key==='n'){nextAwaiting();return;}
  const moves:Record<string,Coord>={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    q:{x:-1,y:-1},e:{x:1,y:-1},z:{x:-1,y:1},c:{x:1,y:1}};
  if(ev.key==='Escape'){
    if(orderMode){cancelOrderMode();return;}
    selectedUnit=null;selectedCity=null;spectatorContact=null;spectatorCity=null;refresh();return;
  }
  if(ev.key==='+'||ev.key==='='){beginZoomGesture();zoom(3);return;}
  if(ev.key==='-'){beginZoomGesture();zoom(-3);return;}
  const delta=moves[ev.key];if(!delta||!selectedUnit)return;
  const u=view.ownUnits.find(u=>u.id===selectedUnit);if(!u)return;
  ev.preventDefault();tapTile({x:u.position.x+delta.x,y:u.position.y+delta.y},false);
});
el('nextRound').addEventListener('click',()=>{
  if(game.scenario==='ai-vs-ai'){
    startRoundPlayback(false);
    return;
  }
  setMapActivity('Computer turn','Resolving round…');
  requestAnimationFrame(()=>{
    window.setTimeout(()=>{
      const since=game.nextEventId;
      const ok=dispatch(()=>advanceLabRound(game),false,null);
      setMapActivity(null);
      if(ok){undoStack=[];combatMarkersSince=since;syncUndoButton();paint();}
      if(ok)uiMessage(`Round ${game.round}. Red has completed its response turn.`);
    },0);
  });
});
el('zoomIn').addEventListener('click',()=>{beginZoomGesture();zoom(4);});
el('zoomOut').addEventListener('click',()=>{beginZoomGesture();zoom(-4);});
el('events').addEventListener('click',ev=>{
  const link=(ev.target as HTMLElement).closest<HTMLElement>('.report-link');
  if(!link)return;
  const unitId=link.dataset.unit??null,cityId=link.dataset.city??null;
  const at=referenceTarget(view,unitId?{unit:unitId}:{city:cityId??''});
  if(!at){uiMessage('That is no longer on your map.');return;}
  cancelOrderMode();
  selectedUnit=null;selectedCity=null;spectatorContact=null;spectatorCity=null;
  if(unitId){
    if(view.ownUnits.some(u=>u.id===unitId))selectedUnit=unitId;else spectatorContact=unitId;
  }else if(cityId){
    if(view.ownCities.some(c=>c.id===cityId))selectedCity=cityId;else spectatorCity=cityId;
  }
  focus(at);refresh();
});
el('undoButton').addEventListener('click',()=>undo());
el('nextUnit').addEventListener('click',()=>nextAwaiting());
el('orderConfirm').addEventListener('click',()=>commitOrderMode());
el('orderCancel').addEventListener('click',()=>{cancelOrderMode();uiMessage('Order cancelled.');});
el('recenter').addEventListener('click',()=>focus(view.ownUnits.find(u=>u.id===selectedUnit)?.position??view.ownCities[0]?.position??{x:8,y:25}));
function downloadText(filename:string,text:string):void{
  const data=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(data);
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function syncMenuFromCampaign(campaign:NonNullable<Game['campaignMap']>):void{
  applyRecipeToMenu(mapRecipeFromCampaign(campaign));
  applyAiPolicyToMenu(game.aiPolicy);
}
function recipeForCopy():MapRecipe{
  if(game.campaignMap)return mapRecipeFromCampaign(game.campaignMap);
  return currentMenuRecipe();
}
el('exportSave').addEventListener('click',()=>{
  const map=game.campaignMap;
  const name=map
    ?`empirata-${map.layout}-seed-${map.seed}-round-${game.round}.json`
    :`empirata-lab-round-${game.round}.json`;
  downloadText(name,exportSave(game));
});
el('importSave').addEventListener('click',()=>(el('saveFile') as HTMLInputElement).click());
el('saveFile').addEventListener('change',async()=>{
  const input=el('saveFile') as HTMLInputElement,file=input.files?.[0];if(!file)return;
  pausePlayback();
  try{const loaded=importSave(await file.text());if(loaded.active!=='blue')throw new Error('This lab UI only supports saves during the blue faction turn.');
    resultModal.reset();spectatorContact=null;spectatorCity=null;orderMode=null;game=loaded;selectedUnit=null;selectedCity=null;
    if(loaded.campaignMap)syncMenuFromCampaign(loaded.campaignMap);
    invalidateMapLayer();
    refresh();void saveLocally(game);uiMessage('Saved game imported.');}
  catch(error){uiMessage(error instanceof Error?error.message:'Save could not be loaded.');}finally{input.value='';}
});
el('copyMapSeed').addEventListener('click',async()=>{
  try{
    const recipe=recipeForCopy();
    const text=`${formatMapSeedLine(recipe)}\n${serializeMapRecipe(recipe)}`;
    await navigator.clipboard.writeText(text);
    uiMessage(`Copied ${formatMapSeedLine(recipe)}.`);
  }catch(error){uiMessage(error instanceof Error?error.message:'Could not copy map seed.');}
});
el('exportMapRecipe').addEventListener('click',()=>{
  try{
    const recipe=recipeForCopy();
    downloadText(`empirata-map-${recipe.layout}-${recipe.seed}.json`,serializeMapRecipe(recipe));
    uiMessage(`Exported map recipe for ${formatMapSeedLine(recipe)}.`);
  }catch(error){uiMessage(error instanceof Error?error.message:'Could not export map recipe.');}
});
el('importMapRecipe').addEventListener('click',()=>(el('recipeFile') as HTMLInputElement).click());
el('recipeFile').addEventListener('change',async()=>{
  const input=el('recipeFile') as HTMLInputElement,file=input.files?.[0];if(!file)return;
  try{
    const recipe=parseMapRecipe(await file.text());
    applyRecipeToMenu(recipe);
    uiMessage(`Loaded map recipe ${formatMapSeedLine(recipe)}. Press Start campaign when ready.`);
  }catch(error){uiMessage(error instanceof Error?error.message:'Map recipe could not be loaded.');}
  finally{input.value='';}
});
let gameMenuReturnFocus:HTMLElement|null=null;
function openGameMenu():void{
  gameMenuReturnFocus=document.activeElement as HTMLElement;
  if(game.campaignMap)syncMenuFromCampaign(game.campaignMap);
  if(!gameMenuDialog.open)gameMenuDialog.showModal();
  el('campaignMode').focus();
}
function closeGameMenu():void{if(gameMenuDialog.open)gameMenuDialog.close();}
el('gameMenu').addEventListener('click',()=>openGameMenu());
gameMenuDialog.addEventListener('close',()=>{
  if(gameMenuReturnFocus){gameMenuReturnFocus.focus();gameMenuReturnFocus=null;}
});
function startScenario(kind:'close-quarters'|'classic-lab'|'ai-invasion'|'ai-vs-ai'|'ai-skirmish'):void{
  closeGameMenu();
  rememberReplacedGame();
  pausePlayback();resultModal.reset();spectatorContact=null;spectatorCity=null;observer='blue';spectatorMode='both';orderMode=null;game=kind==='ai-skirmish'?makeAiVsAiSkirmishLab():kind==='ai-vs-ai'?makeAiVsAiLab():kind==='ai-invasion'?makeAiInvasionLab():kind==='close-quarters'?makeCloseQuartersLab():makeRulesLab();
  selectedUnit=kind==='ai-invasion'||kind==='ai-vs-ai'||kind==='ai-skirmish'?null:'u1';selectedCity=null;invalidateMapLayer();refresh();focus(kind==='ai-invasion'?{x:76,y:29}:{x:9,y:25});
  void saveLocally(game).catch(()=>uiMessage('Local save unavailable; export JSON.'));
  syncUndoButton();
  uiMessage(`${game.scenario==='ai-vs-ai'?'Computer vs computer ready. Press Play.':kind==='ai-invasion'?'AI Invasion ready. Press Next round to watch the landing.':kind==='close-quarters'?'Close Quarters ready. Select a blue unit, then tap an adjacent enemy or city.':'Classic rules lab reset.'} Undo restores your previous game.`);
}
function startCampaign(layout?:CampaignLayout,seed?:number,mode?:CampaignMode,algorithm?:MapAlgorithm,density?:CityDensity,aiPolicy?:AiPolicy):void{
  const source=seedSource();
  const chosenMode=mode??(el('campaignMode') as HTMLSelectElement).value as CampaignMode;
  const chosenAlgorithm=algorithm??(el('campaignAlgorithm') as HTMLSelectElement).value as MapAlgorithm;
  const chosenDensity=density??(el('campaignDensity') as HTMLSelectElement).value as CityDensity;
  const layoutRaw=layout??(el('campaignLayout') as HTMLSelectElement).value;
  if(!isCampaignLayout(layoutRaw)||!isMapAlgorithm(chosenAlgorithm)||!isCityDensity(chosenDensity)){
    uiMessage('Campaign options are invalid.');return;
  }
  let chosenSeed=seed;
  if(chosenSeed===undefined){
    if(source==='random')chosenSeed=randomCampaignSeed();
    else chosenSeed=parseCampaignSeed((el('campaignSeed') as HTMLInputElement).value)??undefined;
  }
  if(chosenSeed===undefined){uiMessage('Enter a positive integer seed between 1 and 4294967295.');return;}
  closeGameMenu();
  rememberReplacedGame();
  (el('campaignLayout') as HTMLSelectElement).value=layoutRaw;
  (el('campaignMode') as HTMLSelectElement).value=chosenMode;
  (el('campaignAlgorithm') as HTMLSelectElement).value=chosenAlgorithm;
  (el('campaignDensity') as HTMLSelectElement).value=chosenDensity;
  (el('campaignSeed') as HTMLInputElement).value=String(chosenSeed);
  if(source!=='random')(el('campaignSeedSource') as HTMLSelectElement).value='custom';
  syncCampaignSeedControls();
  const policy=aiPolicy??readCampaignAiPolicy();
  applyAiPolicyToMenu(policy);
  pausePlayback();resultModal.reset();spectatorContact=null;spectatorCity=null;observer='blue';spectatorMode='both';orderMode=null;
  game=makeCampaignMap(layoutRaw,chosenSeed,chosenMode,false,{algorithm:chosenAlgorithm,density:chosenDensity,aiPolicy:policy});
  selectedUnit=null;selectedCity=null;invalidateMapLayer();refresh();
  const home=game.cities.find(city=>city.owner==='blue');if(home)focus(home.position);
  void saveLocally(game).catch(()=>uiMessage('Local save unavailable; use Export JSON.'));
  const opponent=formatAiPolicyLabel(policy);
  syncUndoButton();
  uiMessage(chosenMode==='ai-vs-ai'?`Computer vs computer on ${layoutRaw}, seed ${chosenSeed} (${opponent}). Press Play. Undo restores your previous game.`:`New campaign on ${layoutRaw}, seed ${chosenSeed} (${opponent}). Your city is marked: tap it to choose production. Undo restores your previous game.`);
}
el('campaignSeedSource').addEventListener('change',()=>syncCampaignSeedControls());
el('campaignAiPolicy').addEventListener('change',()=>syncCampaignClassicGrade());
syncCampaignSeedControls();
syncCampaignClassicGrade();
el('startCampaign').addEventListener('click',()=>startCampaign());
el('newGame').addEventListener('click',()=>startScenario('close-quarters'));
const studyMapButtons=document.querySelectorAll('.studyMapButton');
for(let i=0;i<studyMapButtons.length;i++){
  const button=studyMapButtons[i] as HTMLButtonElement;
  button.addEventListener('click',()=>{
    const layout=button.dataset.layout;
    const seed=parseCampaignSeed(button.dataset.seed);
    if(!isCampaignLayout(layout)||seed===null){uiMessage('Study map button is misconfigured.');return;}
    const mode=(el('campaignMode') as HTMLSelectElement).value as CampaignMode;
    startCampaign(layout,seed,mode,'ellipse-v1','sparse');
  });
}
// Close the Game menu after save actions; starts close themselves after confirm.
const closeMenuIds=['exportSave','importSave','copyMapSeed','exportMapRecipe'];
for(let i=0;i<closeMenuIds.length;i++){
  el(closeMenuIds[i]!).addEventListener('click',()=>closeGameMenu());
}
el('classicGame').addEventListener('click',()=>startScenario('classic-lab'));
el('invasionGame').addEventListener('click',()=>startScenario('ai-invasion'));
el('aiSkirmishGame').addEventListener('click',()=>startScenario('ai-skirmish'));
el('aiVsAiGame').addEventListener('click',()=>startScenario('ai-vs-ai'));
el('spectatorOrderGoals').addEventListener('change',()=>{
  showSpectatorOrderGoals=(el('spectatorOrderGoals') as HTMLInputElement).checked;
  pathOverlayKey='';
  paint();
});
el('spectatorTerrain').addEventListener('change',()=>{
  revealSpectatorTerrain=(el('spectatorTerrain') as HTMLInputElement).checked;
  invalidateMapLayer();
  paint();
  uiMessage(revealSpectatorTerrain?'Unexplored terrain is shaded 75%; explored but unseen is shaded 52%. AI intelligence is unchanged.':'Spectator map now shows only the current observe setting’s discovered terrain.');
});
el('spectatorSide').addEventListener('change',()=>{
  spectatorMode=(el('spectatorSide') as HTMLSelectElement).value as 'both'|'blue'|'red';
  observer=spectatorMode==='both'?'blue':spectatorMode;
  selectedUnit=null;selectedCity=null;spectatorContact=null;spectatorCity=null;refresh();
  uiMessage(
    spectatorMode==='both'
      ? 'Observing the union of Blue and Red intelligence (not omniscient).'
      : `Observing ${spectatorMode.toUpperCase()} intelligence. Hidden enemy information remains concealed.`,
  );
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
el('resultNewGame').addEventListener('click',()=>game.campaignMap?startCampaign(game.campaignMap.layout,game.campaignMap.seed,game.scenario==='ai-vs-ai'?'ai-vs-ai':'user-vs-computer',game.campaignMap.algorithm,game.campaignMap.density,game.aiPolicy):startScenario(game.scenario==='ai-vs-ai'?'ai-vs-ai':'close-quarters'));
el('resultReview').addEventListener('click',()=>resultModal.show());
el('endgameExport').addEventListener('click',()=>el('exportSave').click());
el('endgameNewGame').addEventListener('click',()=>el('resultNewGame').click());
el('resultExport').addEventListener('click',()=>el('exportSave').click());
new ResizeObserver(resize).observe(canvas);
async function boot():Promise<void>{
  try{const saved=await loadLocal();if(saved?.active==='blue')game=saved;}catch{uiMessage('Could not load local autosave; use Import JSON if needed.');}
  if(hydrated)return;hydrated=true;selectedUnit=game.units.some(u=>u.id==='u1'&&u.owner==='blue')?'u1':null;invalidateMapLayer();refresh();focus(game.campaignMap?game.cities.find(c=>c.owner==='blue')?.position??{x:50,y:30}:game.scenario==='ai-invasion'?{x:76,y:29}:{x:9,y:25});
  if(game.scenario==='ai-vs-ai')uiMessage('Computer versus computer restored, paused. Press Play to resume.');
  else if(game.scenario==='user-vs-computer')uiMessage(`User versus computer restored on ${game.campaignMap?.layout??'test map'}. Select your city to set production, then advance rounds.`);
  else if(game.scenario==='ai-invasion')uiMessage('AI Invasion restored. Press Next round to watch the invasion.');
  else if(game.scenario==='close-quarters')uiMessage('Select a blue unit, then tap an adjacent red unit or gold city to fight.');
  else uiMessage('Existing saved game restored. Choose Start Close Quarters to try the immediate combat scenario.');
  if(game.campaignMap&&resolveAiPolicy(game).kind==='modern-experimental')uiMessage('This save uses the frozen Modern (experimental) AI. Start a new campaign to use Classic DOS AI.');
}
void boot();
